import { Transform } from "../utils/transform";
import { MeshData, PrimitiveType, Type } from "./mesh-data";
import { MeshLoader } from "./mesh-loader";

export class MeshRenderer {
    private device: GPUDevice;
    private pipeline: GPURenderPipeline | null = null;
    public transform: Transform;

    private uniformBuffer: GPUBuffer;
    private modelBuffer: GPUBuffer | null = null;
    private vertexBuffer: GPUBuffer | null = null;
    private indexBuffer: GPUBuffer | null = null;
    private bindGroup: GPUBindGroup | null = null;
    private indexFormat: GPUIndexFormat = 'uint32';

    private meshData!: MeshData;
    private meshRenderers: Map<string, MeshRenderer> = new Map();
    
    constructor(device: GPUDevice, uniformBuffer: GPUBuffer) {
        this.device = device;
        this.uniformBuffer = uniformBuffer;
        this.transform = new Transform();
    }

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

    /**
     * Setup
     */
    public async setup(uniformBuffer: GPUBuffer): Promise<void> {
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

        this.bindGroup = this.device.createBindGroup({
            layout: this.getBindGroupLayout(),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: uniformBuffer }
                },
                {
                    binding: 1,
                    resource: { buffer: this.modelBuffer }
                }
            ]
        });
    }

    public async set(type: Type): Promise<void> {
        const meshData = MeshLoader.getMesh(type);
        if(!meshData) {
            console.warn(`Mesh type ${type} not found`);
            return;
        }
        this.meshData = meshData;
        await this.setup(this.uniformBuffer);
    }

    /**
     * Render
     */
    public render(renderPass: GPURenderPassEncoder, pipeline: GPURenderPipeline): void {
        if(!this.vertexBuffer || !this.indexBuffer) throw new Error('Mesh renderer not init!');
        
        this.updateModelMatrix();

        renderPass.setPipeline(pipeline);
        renderPass.setVertexBuffer(0, this.vertexBuffer);
        renderPass.setIndexBuffer(this.indexBuffer, this.indexFormat);
        renderPass.setBindGroup(0, this.bindGroup);
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
}