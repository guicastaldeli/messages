import { MeshRenderer } from "./mesh/mesh-renderer";
import { Type } from "./mesh/mesh-data";
import { Camera } from "./camera";
import { MeshLoader } from "./mesh/mesh-loader";

export class Scene {
    private device: GPUDevice;
    private camera: Camera;

    private meshRenderers: MeshRenderer[] = [];

    constructor(device: GPUDevice, camera: Camera) {
        this.device = device;
        this.camera = camera;
    }

    /**
     * Update
     */
    public async update(deltaTime: number): Promise<void> {
        this.meshRenderers[0].transform.rotate(0.0, deltaTime, 0.0);
        this.meshRenderers[1].transform.rotate(0.0, deltaTime * 3.0, 0.0);
    }

    /**
     * Render
     */
    public async render(renderPass: GPURenderPassEncoder, pipeline: GPURenderPipeline): Promise<void> {
        for(const renderer of this.meshRenderers) {
            renderer.render(renderPass, pipeline);
        }
    }

    /**
     * Init
     */
    public async init(): Promise<void> {
        this.camera.setTarget(0, 0, 0);

        await MeshLoader.load();

        const dino = new MeshRenderer(this.device, this.camera.getUniformBuffer());
        dino.transform.setPosition(0.0, -2.0, -100.0);
        await dino.set(Type.DINO);
        this.meshRenderers.push(dino);

        const pyramid = new MeshRenderer(this.device, this.camera.getUniformBuffer());
        pyramid.transform.setPosition(2.0, 0.0, -200.0);
        await pyramid.set(Type.PYRAMID);
        this.meshRenderers.push(pyramid);
    }
}