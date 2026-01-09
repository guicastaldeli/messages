import { MeshData, PrimitiveType } from "./mesh-data";

export class MeshRenderer {
    private device: GPUDevice;
    private pipeline: GPURenderPipeline | null = null;
    private vertexBuffer: GPUBuffer | null = null;
    private indexBuffer: GPUBuffer | null = null;
    private bindGroup: GPUBindGroup | null = null;
    private indexFormat: GPUIndexFormat = 'uint32';

    private meshData: MeshData;
    
    constructor(device: GPUDevice, meshData: MeshData) {
        this.device = device;
        this.meshData = meshData;
    }

    private getBindGroupLayout(): GPUBindGroupLayout {
        return this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                }
            ]
        });
    }

    public getMeshData(): MeshData {
        return this.meshData;
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

        this.bindGroup = this.device.createBindGroup({
            layout: this.getBindGroupLayout(),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: uniformBuffer }
                }
            ]
        });
    }

    /**
     * Render
     */
    public render(renderPass: GPURenderPassEncoder, pipeline: GPURenderPipeline): void {
        if(!this.vertexBuffer || !this.indexBuffer) throw new Error('Mesh renderer not init!');
        
        renderPass.setPipeline(pipeline);
        renderPass.setVertexBuffer(0, this.vertexBuffer);
        renderPass.setIndexBuffer(this.indexBuffer, this.indexFormat);
        renderPass.setBindGroup(0, this.bindGroup);
        renderPass.drawIndexed(this.meshData.getIndexCount());
    }

    public cleanup(): void {
        if(this.vertexBuffer) this.vertexBuffer.destroy();
        if(this.indexBuffer) this.indexBuffer.destroy();
        if(this.bindGroup) this.bindGroup = null;
    }
}