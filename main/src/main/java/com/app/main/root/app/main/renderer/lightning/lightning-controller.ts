import { AmbientLight } from "./ambient-light";
import { DirectionalLight } from "./directional-light";

export class LightningController {
    private device: GPUDevice;
    private bindGroup: GPUBindGroup | null = null;
    private bindGroupLayout: GPUBindGroupLayout | null = null;

    private lightningBuffer: GPUBuffer | null = null;
    private ambientLight: AmbientLight | null = null;
    private directionalLights: DirectionalLight[] = [];

    constructor(device: GPUDevice) {
        this.device = device;
        this.createLightningBuffer();
        this.setDefaultLightning();
    }

    /**
     * Create Lightning Buffer
     */
    private createLightningBuffer(): void {
        this.lightningBuffer = this.device.createBuffer({
            size: 72,
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
                resource: { buffer: this.lightningBuffer }
            }]
        });
    }

    private setDefaultLightning(): void {
        this.setAmbientLight(new AmbientLight());
        this.addDirectionalLight(new DirectionalLight());
    }

    public clearDirectionalLights(): void {
        this.directionalLights = [];
        this.updateLightningBuffer();
    }

    /**
     * Ambient Light
     */
    public setAmbientLight(light: AmbientLight): void {
        this.ambientLight = light;
        this.updateLightningBuffer();
    }

    public getAmbientLight(): AmbientLight | null {
        return this.ambientLight;
    }

    /**
     * Directional Light
     */
    public addDirectionalLight(light: DirectionalLight): void {
        this.directionalLights.push(light);
        this.updateLightningBuffer();
    }

    public getDirectionalLights(): DirectionalLight[] {
        return [...this.directionalLights];
    }

    /**
     * Update Lightning Buffer
     */
    private updateLightningBuffer(): void {
        if(!this.lightningBuffer) return;

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
        
        this.device.queue.writeBuffer(this.lightningBuffer, 0, data);
    }

    public getBindGroup(): GPUBindGroup | null {
        return this.bindGroup;
    }

    public getBindGroupLayout(): GPUBindGroupLayout | null {
        return this.bindGroupLayout;
    }

    public update(): void {
        this.updateLightningBuffer();
    }
}