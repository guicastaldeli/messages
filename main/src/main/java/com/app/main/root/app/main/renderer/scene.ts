import { MeshRenderer } from "./mesh/mesh-renderer";
import { PrimitiveType, Type } from "./mesh/mesh-data";
import { Camera } from "./camera";
import { MeshLoader } from "./mesh/mesh-loader";
import { Tick } from "./tick";
import { Raycaster } from "./raycaster";
import { DocParser, ParsedElement, SceneConfig } from "./doc-parser";

export interface ElementHandler {
    type: string;
    create: (config: any, device: GPUDevice, camera: Camera) => Promise<any>;
    update?: (el: any, config: any) => void;
    destroy?: (el: any) => void;
}

export class Scene {
    private static readonly SCENE_URL = './scene.xml';

    private canvas: HTMLCanvasElement;
    private device: GPUDevice;
    private camera: Camera;
    
    private elements: Map<string, any[]> = new Map();
    private elementHandlers: Map<string, ElementHandler> = new Map();
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
        this.registerDefaultHandlers();
        this.loadScene();
    }

    /**
     * Register Default Handlers
     */
    private registerDefaultHandlers(): void {
        this.registerHandler({
            type: 'camera',
            create: async (config: any) => {
                this.camera.setPosition(
                    config['position-x'], 
                    config['position-y'], 
                    config['position-z']
                );
                this.camera.setTarget(
                    config['target-x'], 
                    config['target-y'], 
                    config['target-z']
                );
                return this.camera;
            }
        });
        this.registerHandler({
            type: 'mesh',
            create: async (config: any) => {
                const meshRenderer = new MeshRenderer(this.device, this.camera.getUniformBuffer());
                meshRenderer.transform.setPosition(
                    config['position-x'], 
                    config['position-y'], 
                    config['position-z']
                );
                meshRenderer.transform.setRotation(
                    config['rotation-x'], 
                    config['rotation-y'], 
                    config['rotation-z']
                );
                meshRenderer.transform.setScale(
                    config['scale-x'], 
                    config['scale-y'], 
                    config['scale-z']
                );
                
                await meshRenderer.set(config.type as Type, config.texture);

                const meshData = meshRenderer.getMeshData();
                if(meshData) {
                    meshData.setFollowRotation(config.followRotation);
                    meshData.setAutoRotate(config.autoRotate);
                    meshData.setRotationSpeed(config.rotationSpeed);
                }
                return meshRenderer;
            }
        });
    }

    private registerHandler(handler: ElementHandler): void {
        this.elementHandlers.set(handler.type, handler);
    }

    /**
     * Load Scene
     */
    public async loadScene(): Promise<void> {
        try {
            const res = await fetch(Scene.SCENE_URL);
            if(!res.ok) throw new Error(`Failed to load scene: ${res.statusText}`);

            const content = await res.text();
            const sceneConfig = DocParser.parseScene(content);

            const error = DocParser.validateConfig(sceneConfig);
            if(error.length > 0) {
                console.warn('Scene config err!', error);
            }

            await this.initFromConfig(sceneConfig);
        } catch(err) {
            console.error('Error scene', err);
            return;
        }
    }

    /**
     * Init from Config
     */
    private async initFromConfig(sceneConfig: SceneConfig): Promise<void> {
        await MeshLoader.load();
        this.elements.clear();

        const sortedEl = sceneConfig.elements.sort((a, b) => {
            if(a.type === 'camera') return -1;
            if(b.type === 'camera') return 1;
            return 0;
        });
        
        for(const el of sortedEl) {
            await this.createEl(el);
        }
    }
    
    /**
     * Create Elment
     */
    private async createEl(el: ParsedElement, parent?: any): Promise<any> {
        const handler = this.elementHandlers.get(el.type);
        if(!handler) {
            console.warn(`No handler registered for element: ${el.type}`);
            return null;
        }

        try {
            const instance = await handler.create(
                el.properties,
                this.device,
                this.camera
            );
            if(!this.elements.has(el.type)) {
                this.elements.set(el.type, []);
            }

            this.elements.get(el.type)!.push(instance);

            for(const child of el.children) {
                const childInstance = await this.createEl(child, instance);
                if(childInstance && parent && parent.children) {
                    parent.children.push(childInstance);
                }
            }

            return instance;
        } catch(error) {
            console.error(`Error creating ${el.type}:`, error);
            return null;
        }
    }

    public getElementsByType<T>(type: string): T[] {
        return (this.elements.get(type) || []) as T[];
    }

    /**
     * Update
     */
    public async update(): Promise<void> {
        if(this.raycaster) this.raycaster.getRotationBox().update(this.getElementsByType<MeshRenderer>('mesh'));

        const meshes = this.getElementsByType<MeshRenderer>('mesh');
        for(const mesh of meshes) {
            const meshData = mesh.getMeshData();
            if(meshData && meshData.autoRotate) {
                const speed = Tick.getDeltaTime() * meshData.rotationSpeed;
                if(meshData.name === 'stars') {
                    const angle = Math.sqrt(2) / 2;
                    const starSpeed = speed * angle;
                    mesh.transform.rotate(starSpeed, 0.0, starSpeed);
                } else {
                    mesh.transform.rotate(0.0, speed, 0.0);
                }
            }
        }
    }

    /**
     * Render
     */
    public async render(
        renderPass: GPURenderPassEncoder, 
        pipelines: Map<string, GPURenderPipeline>,
        lightningBindGroup: GPUBindGroup
    ): Promise<void> {
        const meshes = this.getElementsByType<MeshRenderer>('mesh');
        
        for(const renderer of meshes) {
            const meshData = renderer.getMeshData();
            if(meshData.name !== 'stars') {
                const pipeline = pipelines.get('lightning');
                if(pipeline) {
                    renderer.render(
                        renderPass, 
                        pipeline,
                        lightningBindGroup
                    );
                }
            }
        }
        for(const renderer of meshes) {
            const meshData = renderer.getMeshData();
            if(meshData.name === 'stars') {
                const pipeline = pipelines.get('stars');
                if(pipeline) {
                    renderer.render(
                        renderPass, 
                        pipeline,
                        lightningBindGroup
                    );
                }
            }
        }
    }

    /**
     * Init
     */
    public async init(): Promise<void> {
        
    }
}