import { MeshRenderer } from "./mesh/mesh-renderer";
import { Type } from "./mesh/mesh-data";
import { Camera } from "./camera";

export class Scene {
    private device: GPUDevice;
    private camera: Camera;

    private meshRenderer!: MeshRenderer;

    constructor(device: GPUDevice, camera: Camera) {
        this.device = device;
        this.camera = camera;
        this.meshRenderer = new MeshRenderer(
            this.device, 
            this.camera.getUniformBuffer()
        );
    }

    /**
     * Update
     */
    public async update(): Promise<void> {

    }

    /**
     * Render
     */
    public async render(renderPass: GPURenderPassEncoder, pipeline: GPURenderPipeline): Promise<void> {
        this.meshRenderer.render(renderPass, pipeline);
    }

    /**
     * Init
     */
    public async init(): Promise<void> {
        this.camera.setTarget(0, 0, 0);

        await this.meshRenderer.init();
        await this.meshRenderer.set(Type.TREE);
    }
}