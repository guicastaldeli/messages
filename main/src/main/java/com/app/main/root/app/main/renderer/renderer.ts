import { ShaderLoader } from "./shader/shader-loader";
import { ShaderConfig } from "./shader/shader-config";

export class Renderer {
    private canvas: HTMLCanvasElement | null = null;
    private ctx: GPUCanvasContext | null = null;
    private device: GPUDevice | null = null;
    private pipelines: Map<string, GPURenderPipeline> = new Map();

    private shaderLoader: ShaderLoader;

    constructor() {
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
                }
            ]
        });

        const mainLayout = this.shaderLoader.createPipelineLayout([bindGroupLayout]);
        const mainPipeline = this.shaderLoader.createRenderPipeline(
            'MAIN',
            mainLayout,
            ShaderConfig.get().vertexBufferLayouts,
            [navigator.gpu.getPreferredCanvasFormat()],
            ShaderConfig.get().depthStencil
        );
        this.pipelines.set('main', mainPipeline);
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

        this.shaderLoader.setDevice(this.device);
        this.shaderLoader.onLoaded((p) => {
            console.log(`Shader Loaded!: ${p.name}`);
        });
        this.shaderLoader.onError((err, name) => {
            console.error(`Shader error in ${name}:`, err);
        });
    }

    /**
     * Render
     */
    public async render(): Promise<void> {
        if(!this.device || !this.ctx) return;

        const commandEncoder = this.device.createCommandEncoder();
        const texView = this.ctx.getCurrentTexture().createView();

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: texView,
                clearValue: { r: 0.1, g: 0.2, b: 0.2, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        });
        renderPass.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }

    public async init() {
        try {
            await this.shaderLoader.loadProgram('MAIN');
            await this.createPipeline();
        }  catch(err) {
            console.error('Failed to init shaders:', err);
            throw err;
        } 
    }
}