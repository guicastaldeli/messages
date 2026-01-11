import { ShaderLoader } from "./shader/shader-loader";
import { ShaderConfig } from "./shader/shader-config";
import { Camera } from "./camera";
import { Scene } from "./scene";
import { Tick } from "./tick";

export class Renderer {
    private canvas: HTMLCanvasElement | null = null;
    private ctx: GPUCanvasContext | null = null;
    private device: GPUDevice | null = null;
    private pipelines: Map<string, GPURenderPipeline> = new Map();

    private tick: Tick;
    private camera: Camera | null = null;
    private shaderLoader: ShaderLoader;
    private scene!: Scene;

    private isRunning: boolean = false;
    private lastTime: number = 0;

    constructor() {
        this.tick = new Tick();
        this.shaderLoader = new ShaderLoader();
        ShaderConfig.getInstance();
    }

    /**
     * Create Pipeline
     */
    private async createPipeline(): Promise<void> {
        if(!this.device || !this.ctx) return;

        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' as const }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform' as const }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' as const }
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: 'float' as const }
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: 'filtering' as const }
                }
            ]
        });

        const mainLayout = this.shaderLoader.createPipelineLayout([bindGroupLayout]);
        const mainPipeline = this.shaderLoader.createRenderPipeline(
            'MAIN',
            mainLayout,
            ShaderConfig.get().vertexBufferLayouts,
            [navigator.gpu.getPreferredCanvasFormat()],
            ShaderConfig.get().depthStencil,
            ShaderConfig.get().primitiveState
        );
        this.pipelines.set('main', mainPipeline);

        const starsState: GPUPrimitiveState = {
            topology: 'point-list',
            cullMode: 'none',
            frontFace: 'ccw'
        }

        const starsPipeline = this.shaderLoader.createRenderPipeline(
            'SKYBOX',
            mainLayout,
            ShaderConfig.get().vertexBufferLayouts,
            [navigator.gpu.getPreferredCanvasFormat()],
            ShaderConfig.get().depthStencil,
            starsState
        );
        this.pipelines.set('stars', starsPipeline);
    }

    /**
     * Setup
     */
    public async setup(canvasId: string): Promise<void> {
        this.canvas = document.querySelector(`#${canvasId}`);
        if(!this.canvas) throw new Error('Canvas err');

        this.ctx = this.canvas.getContext('webgpu');
        if(!this.ctx) throw new Error('webgpu err');

        const adapter = await navigator.gpu.requestAdapter();
        if(!adapter) throw new Error('No adapter found!');

        this.device = await adapter.requestDevice();
        if(!this.device) throw new Error('No device found!');

        this.ctx?.configure({
            device: this.device,
            format: navigator.gpu.getPreferredCanvasFormat(),
            alphaMode: "premultiplied"
        });

        await this.init();
    }

    /**
     * Update
     */
    public async update(): Promise<void> {
        if(this.isRunning) return;
        this.isRunning = true;

        const update = async (currentTime: number) => {
            if(!this.isRunning) return;

            this.tick.update(currentTime);
            const deltaTime = (currentTime - this.lastTime);
            this.lastTime = currentTime;

            const currentFps = 1.0 / deltaTime;
            //console.log(`FPS: ${currentFps.toFixed(1)}`);

            if(this.camera) this.camera.update();
            await this.render();

            await this.scene.update();

            requestAnimationFrame(update);
        }

        requestAnimationFrame((t) => {
            this.lastTime = t;
            update(t);
        });
    }

    /**
     * Init
     */
    private async init(): Promise<void> {
        if(!this.device || !this.ctx) return;

        this.shaderLoader.setDevice(this.device);
        this.shaderLoader.onLoaded((p) => {
            console.log(`Shader Loaded!: ${p.name}`);
        });
        this.shaderLoader.onError((err, name) => {
            console.error(`Shader error in ${name}:`, err);
        });

        await this.shaderLoader.loadProgram('MAIN');
        await this.shaderLoader.loadProgram('SKYBOX');
        await this.createPipeline();

        this.camera = new Camera(this.device!, this.pipelines);
        this.camera.init();

        this.scene = new Scene(
            this.canvas!,
            this.device, 
            this.camera
        );
        await this.scene.init();
    }

    /**
     * Render
     */
    public async render(): Promise<void> {
        if(!this.device || !this.ctx) return;

        const commandEncoder = this.device.createCommandEncoder();
        const texView = this.ctx.getCurrentTexture().createView();

        const depthTexture = this.device.createTexture({
            size: {
                width: this.canvas!.width,
                height: this.canvas!.height
            },
            format: 'depth24plus-stencil8',
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: texView,
                clearValue: { r: 0.1, g: 0.2, b: 0.2, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
                stencilClearValue: 0,
                stencilLoadOp: 'clear',
                stencilStoreOp: 'store'
            }
        });

        const mainPipeline = this.pipelines.get('main');
        if(mainPipeline && this.scene) {
            this.scene.render(renderPass, this.pipelines);
        }

        renderPass.end();
        this.device.queue.submit([commandEncoder.finish()]);

        depthTexture.destroy();
    }

    public async run(): Promise<void> {
        try {
            const aspect = this.canvas!.width / this.canvas!.height;
            if(this.camera) this.camera.updateAspect(aspect);
        }  catch(err) {
            console.error('Failed to init shaders:', err);
            throw err;
        } 
    }
}