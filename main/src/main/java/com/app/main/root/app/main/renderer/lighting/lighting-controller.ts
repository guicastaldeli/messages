import { AmbientLight } from "./ambient-light";
import { DirectionalLight } from "./directional-light";

export class LightingController {
    private device: GPUDevice;
    private bindGroup: GPUBindGroup | null = null;
    private bindGroupLayout: GPUBindGroupLayout | null = null;

    private lightingBuffer: GPUBuffer | null = null;
    private ambientLight: AmbientLight | null = null;
    private directionalLights: DirectionalLight[] = [];

    constructor(device: GPUDevice) {
        this.device = device;
        this.createLightingBuffer();
        this.setDefaultLighting();
    }

    /**
     * Create Lighting Buffer
     */
    private createLightingBuffer(): void {
        this.lightingBuffer = this.device.createBuffer({
            size: 84,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.bindGroupLayout = this.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' }
            }]
        });
        this.bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [{
                binding: 0,
                resource: { buffer: this.lightingBuffer }
            }]
        });
    }

    private setDefaultLighting(): void {
        this.setAmbientLight(new AmbientLight());
        this.addDirectionalLight(new DirectionalLight());
    }

    public clearDirectionalLights(): void {
        this.directionalLights = [];
        this.updateLightingBuffer();
    }

    /**
     * Ambient Light
     */
    public setAmbientLight(light: AmbientLight): void {
        this.ambientLight = light;
        this.updateLightingBuffer();
    }

    public getAmbientLight(): AmbientLight | null {
        return this.ambientLight;
    }

    /**
     * Directional Light
     */
    public addDirectionalLight(light: DirectionalLight): void {
        this.directionalLights.push(light);
        this.updateLightingBuffer();
    }

    public getDirectionalLights(): DirectionalLight[] {
        return [...this.directionalLights];
    }

    /**
     * Update Lighting Buffer
     */
    private updateLightingBuffer(): void {
        if(!this.lightingBuffer) return;

        const data = new Float32Array(16);

        if(this.ambientLight) {
            const ambientData = this.ambientLight.getData();
            data.set(ambientData, 0);
        }
        if(this.directionalLights.length > 0) {
            const directionalData = this.directionalLights[0].getData();
            data.set(directionalData, 4);
        }

        const lightCountView = new Int32Array(data.buffer, 48, 1);
        lightCountView[0] = this.directionalLights.length;
        
        this.device.queue.writeBuffer(this.lightingBuffer, 0, data);
    }

    public getBindGroup(): GPUBindGroup | null {
        return this.bindGroup;
    }

    public getBindGroupLayout(): GPUBindGroupLayout | null {
        return this.bindGroupLayout;
    }

    public update(): void {
        this.updateLightingBuffer();
    }
}