import { Tick } from "./tick";
import { Vector3Math } from "./utils/vector3math";

export class Camera {
    private device: GPUDevice; 
    private pipelines: Map<string, GPURenderPipeline>;

    private position: [number, number, number] = [0.0, 0.0, 10.0];
    private target: [number, number, number] = [0.0, 0.0, 0.0];
    private up: [number, number, number] = [0.0, 1.0, 0.0];
    private fov: number = 90 * (Math.PI / 180);
    private aspect: number = 1.0;
    private near: number = 0.1;
    private far: number = 1000;

    private yaw: number = 0;
    private pitch: number = 0;
    private radius: number = 100;
    private rotationSpeed: number = 2.0;

    private uniformBuffer: GPUBuffer | null = null;
    private bindGroup: GPUBindGroup | null = null;

    constructor(device: GPUDevice, pipelines: Map<string, GPURenderPipeline>) {
        this.device = device;
        this.pipelines = pipelines;

        this.createUniformBuffer();
        this.setFov(this.fov);
        this.updateAspect(1);
    }

    /**
     * Get View Matrix
     */
    private getViewMatrix(): Float32Array {
        const viewMatrix = new Float32Array(16);

        const forward = Vector3Math.normalize([
            this.target[0] - this.position[0],
            this.target[1] - this.position[1],
            this.target[2] - this.position[2]
        ]);

        const right = Vector3Math.normalize(Vector3Math.cross(this.up, forward));
        const up = Vector3Math.normalize(Vector3Math.cross(forward, right));

        viewMatrix[0] = right[0];
        viewMatrix[1] = up[0];
        viewMatrix[2] = -forward[0];
        viewMatrix[3] = 0;

        viewMatrix[4] = right[1];
        viewMatrix[5] = up[1];
        viewMatrix[6] = -forward[1];
        viewMatrix[7] = 0;

        viewMatrix[8] = right[2];
        viewMatrix[9] = up[2];
        viewMatrix[10] = -forward[2];
        viewMatrix[11] = 0;

        viewMatrix[12] = -Vector3Math.dot(right, this.position);
        viewMatrix[13] = -Vector3Math.dot(up, this.position);
        viewMatrix[14] = Vector3Math.dot(forward, this.position);
        viewMatrix[15] = 1;

        return viewMatrix;
    }

    /**
     * Get Projection Matrix
     */
    private getProjectionMatrix(): Float32Array {
        const projMatrix = new Float32Array(16);
        const f = 1.0 / Math.tan(this.fov / 2);
        const rangeInv = 1.0 / (this.near - this.far);

        projMatrix[0] = f / this.aspect;
        projMatrix[1] = 0;
        projMatrix[2] = 0;
        projMatrix[3] = 0;

        projMatrix[4] = 0;
        projMatrix[5] = f;
        projMatrix[6] = 0;
        projMatrix[7] = 0;

        projMatrix[8] = 0;
        projMatrix[9] = 0;
        projMatrix[10] = (this.far + this.near) * rangeInv;
        projMatrix[11] = -1;

        projMatrix[12] = 0;
        projMatrix[13] = 0;
        projMatrix[14] = (2 * this.far * this.near) * rangeInv;
        projMatrix[15] = 0;

        return projMatrix;
    }

    /**
     * Get View Projection Matrix
     */
    private getViewProjectionMatrix(): Float32Array {
        const view = this.getViewMatrix();
        const proj = this.getProjectionMatrix();
        return Vector3Math.multiplyMatrices(proj, view);
    }

    public setPosition(
        x: number, 
        y: number, 
        z: number
    ): void {
        this.position = [x, y, z];
    }

    public setTarget(
        x: number,
        y: number,
        z: number
    ): void {
        this.target = [x, y, z];
    }

    public updateAspect(aspect: number): void {
        this.aspect = aspect;
    }

    private setFov(degrees: number): void {
        this.fov = degrees * (Math.PI / 180);
    }

    public getUniformBuffer(): GPUBuffer {
        return this.uniformBuffer!;
    }

    public getBindGroup(): GPUBindGroup | null {
        return this.bindGroup;
    }

    public getPosition(): {
        x: number,
        y: number,
        z: number
    } {
        return {
            x: this.position[0],
            y: this.position[1],
            z: this.position[2]
        }
    }

    /**
     * Create Uniform Buffer
     */
    private createUniformBuffer(): void {
        if(!this.device) return;

        this.uniformBuffer = this.device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: 'uniform' }
            }]
        });
        this.bindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [{
                binding: 0,
                resource: {
                    buffer: this.uniformBuffer
                }
            }]
        });
    }

    /**
     * Update Uniform
     */
    private updateUniform(): void {
        if(!this.device || !this.uniformBuffer) return;

        const viewProjMatrix = this.getViewProjectionMatrix();
        this.device.queue.writeBuffer(
            this.uniformBuffer, 
            0, 
            viewProjMatrix.buffer
        );
    }

    public update(): void {
        /*
        this.yaw += this.rotationSpeed * Tick.getDeltaTime();
        this.position[0] = this.target[0] + this.radius * Math.sin(this.yaw);
        this.position[2] = this.target[2] + this.radius * Math.cos(this.yaw);
        */
        this.updateUniform();
    }

    public init(): void {
        this.updateUniform();
    }
}