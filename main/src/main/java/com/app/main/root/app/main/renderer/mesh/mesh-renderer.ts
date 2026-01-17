import { TextureData, TextureLoader } from "../resource/texture-loader";
import { Tick } from "../tick";
import { getRandomColor } from "../utils/RandomColor";
import { Transform } from "../utils/transform";
import { MeshData, PrimitiveType, Type } from "./mesh-data";
import { MeshLoader } from "./mesh-loader";

export class MeshRenderer {
    private device: GPUDevice;
    private pipeline: GPURenderPipeline | null = null;
    public transform: Transform;

    private uniformBuffer: GPUBuffer;
    private modelBuffer: GPUBuffer | null = null;
    private materialBuffer: GPUBuffer | null = null;
    private vertexBuffer: GPUBuffer | null = null;
    private indexBuffer: GPUBuffer | null = null;
    private timeBuffer: GPUBuffer | null = null;

    private bindGroup: GPUBindGroup | null = null;
    private indexFormat: GPUIndexFormat = 'uint32';

    private meshData!: MeshData;
    private textureData!: TextureData;
    private meshRenderers: Map<string, MeshRenderer> = new Map();
    private textureLoader: TextureLoader;

    private useTexture: boolean = false;
    private isChat: boolean = false;
    private isFresnel: boolean = false;

    private floatingEnabled: boolean = false;
    private floatingSpeed: number = 1.0;
    private floatingHeight: number = 0.2;
    private floatingTime: number = 0.0;
    private originalY: number = 0.0;

    constructor(device: GPUDevice, uniformBuffer: GPUBuffer) {
        this.device = device;
        this.uniformBuffer = uniformBuffer;
        this.transform = new Transform();
        this.textureLoader = TextureLoader.getInstance();
        this.textureLoader.setDevice(device);
    }

    /**
     * Bind Group
     */
    private getBindGroupLayout(): GPUBindGroupLayout {
        return this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform' }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: 'float' }
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: 'filtering' }
                }
            ]
        });
    }

    private async updateBindGroup(): Promise<void> {
        if(!this.modelBuffer || !this.materialBuffer) return;
        
        this.bindGroup = this.device.createBindGroup({
            layout: this.getBindGroupLayout(),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniformBuffer }
                },
                {
                    binding: 1,
                    resource: { buffer: this.modelBuffer }
                },
                {
                    binding: 2,
                    resource: { buffer: this.materialBuffer }
                },
                {
                    binding: 3,
                    resource: this.textureData?.view || this.textureLoader.createDefaultTextureView()
                },
                {
                    binding: 4,
                    resource: this.textureData?.sampler || this.textureLoader.createSampler()
                }
            ]
        });
    }

    public getMeshData(): MeshData {
        return this.meshData;
    }

    private updateModelMatrix(): void {
        if(!this.modelBuffer) return;
        const modelMatrix = this.transform.getModelMatrix();
        this.device.queue.writeBuffer(this.modelBuffer, 0, modelMatrix.buffer);
    }

    public setFloatingProps(
        enabled: boolean, 
        speed: number, 
        height: number
    ): void {
        this.floatingEnabled = enabled;
        this.floatingSpeed = speed;
        this.floatingHeight = height;
        this.originalY = this.transform.position[1];
    }

    private chatMeshProps(): void {
        if(this.meshData.name.includes('chat')) {
            this.floatingEnabled = true;
        }
        if(this.meshData.name.includes('chat') && 
        !this.meshData.name.includes('chatdot')) {
            this.isChat = true;
        } else {
            this.isChat = false;
        }
    }

    private fresnelMeshProps(): void {
        if(this.meshData.name.includes('fresnel')) {
            this.isFresnel = true;
        } else {
            this.isFresnel = false;
        }
    }

    /**
     * Setup
     */
    public async setup(): Promise<void> {
        this.vertexBuffer = this.device.createBuffer({
            size: this.meshData.getVertexBufferSize(),
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false
        });
        this.device.queue.writeBuffer(
            this.vertexBuffer,
            0,
            this.meshData.vertices.buffer
        );

        this.indexFormat = this.meshData.indices instanceof Uint32Array ? 'uint32' : 'uint16';
        this.indexBuffer = this.device.createBuffer({
            size: this.meshData.getIndexBufferSize(),
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false
        });
        this.device.queue.writeBuffer(
            this.indexBuffer,
            0,
            this.meshData.indices.buffer
        );

        this.modelBuffer = this.device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        this.materialBuffer = this.device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        this.timeBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.originalY = this.transform.position[1];

        this.chatMeshProps();
        this.fresnelMeshProps();

        let color: [number, number, number];
        if (this.isChat) {
            color = getRandomColor();
        } else {
            color = [1.0, 1.0, 1.0];
        }
        
        const materialData = new Float32Array(16);
        materialData.set([
            this.useTexture ? 1.0 : 0.0,
            this.isChat ? 1.0 : 0.0,
            this.isFresnel ? 1.0 : 0.0,
            0.0,
            color[0], color[1], color[2],
            0.0,
            1.0,
            0.0, 
            0.0
        ]);

        this.device.queue.writeBuffer(this.materialBuffer, 0, materialData.buffer);
        await this.updateBindGroup();
    }

    public async set(type: Type, texUrl?: string): Promise<void> {
        const meshData = MeshLoader.getMesh(type);
        if(!meshData) {
            console.warn(`Mesh type ${type} not found`);
            return;
        }
        this.meshData = meshData;
        if(texUrl) {
            this.textureData = await this.textureLoader.load(texUrl);
            this.useTexture = true;
        } else {
            this.useTexture = false;
        }
        await this.setup();
    }

    /**
     * Render
     */
    public render(
        renderPass: GPURenderPassEncoder, 
        pipeline: GPURenderPipeline,
        lightningBindGroup: GPUBindGroup
    ): void {
        if(!this.vertexBuffer || !this.indexBuffer) throw new Error('Mesh renderer not init!');
        
        this.updateModelMatrix();

        renderPass.setPipeline(pipeline);
        renderPass.setVertexBuffer(0, this.vertexBuffer);
        renderPass.setBindGroup(0, this.bindGroup);

        if(lightningBindGroup) {
            renderPass.setBindGroup(1, lightningBindGroup);
        }

        renderPass.setIndexBuffer(this.indexBuffer, this.indexFormat);
        renderPass.drawIndexed(this.meshData.getIndexCount());
    }

    /**
     * Init
     */
    public async init(): Promise<void> {
        await MeshLoader.load();
    }

    public cleanup(): void {
        if(this.vertexBuffer) this.vertexBuffer.destroy();
        if(this.indexBuffer) this.indexBuffer.destroy();
        if(this.bindGroup) this.bindGroup = null;
    }

    /**
     * Update
     */
    private updateTime(): void {
        const deltaTime = Tick.getDeltaTime();
        const timeData = new Float32Array(20);
        timeData[19] = deltaTime;
        this.device.queue.writeBuffer(this.uniformBuffer, 0, timeData.buffer)
    }

    private updateFloating(): void {
        if(!this.floatingEnabled) return;

        this.floatingTime += Tick.getDeltaTime() * this.floatingSpeed;

        const offsetY = Math.sin(this.floatingTime) * this.floatingHeight;

        const [x, _, z] = this.transform.position;
        this.transform.setPosition(x, this.originalY + offsetY, z);
    }

    public update(): void {
        this.updateTime();
        this.updateFloating();
    }
}