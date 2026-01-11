import { MeshRenderer } from "./mesh/mesh-renderer";
import { Type } from "./mesh/mesh-data";
import { Camera } from "./camera";
import { MeshLoader } from "./mesh/mesh-loader";
import { Tick } from "./tick";
import { Raycaster } from "./raycaster";

export class Scene {
    private canvas: HTMLCanvasElement;
    private device: GPUDevice;
    private camera: Camera;
    
    private meshRenderers: MeshRenderer[] = [];
    private raycaster!: Raycaster;

    constructor(
        canvas: HTMLCanvasElement,
        device: GPUDevice, 
        camera: Camera
    ) {
        this.canvas = canvas;
        this.device = device;
        this.camera = camera;
        this.raycaster = new Raycaster(
            this.canvas!, 
            this.device, 
            this.camera
        );
    }

    /**
     * Update
     */
    public async update(): Promise<void> {
        if(this.raycaster) this.raycaster.getRotationBox().update(this.meshRenderers);

        //this.meshRenderers[0].transform.rotate(0.0, Tick.getDeltaTime() / 2.0, 0.0);
        //this.meshRenderers[1].transform.rotate(0.0, Tick.getDeltaTime(), 0.0);
        //this.meshRenderers[2].transform.rotate(0.0, Tick.getDeltaTime(), 0.0);
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
        await dino.set(Type.DINO, 'rd.png');
        
        const dinoMeshData = dino.getMeshData();
        if(dinoMeshData) dinoMeshData.setFollowRotation(true);
        this.meshRenderers.push(dino);

        const pyramid = new MeshRenderer(this.device, this.camera.getUniformBuffer());
        pyramid.transform.setPosition(2.0, 0.0, -200.0);
        await pyramid.set(Type.PYRAMID);

        const pyramidMeshData = pyramid.getMeshData();
        if(pyramidMeshData) pyramidMeshData.setFollowRotation(true);
        this.meshRenderers.push(pyramid);
    }
}