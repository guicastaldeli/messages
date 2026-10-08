import { Camera } from "./camera";
import { RotationBox } from "./rotation-box";

export class Raycaster {
    private canvas: HTMLCanvasElement;
    private device: GPUDevice;
    private camera: Camera;
    private rotationBox: RotationBox;

    private mousePos: { x: number, y: number } = { x: 0.0, y: 0.0 }
    private isMouseInRotationBox: boolean = false;

    constructor(
        canvas: HTMLCanvasElement,
        device: GPUDevice,
        camera: Camera
    ) {
        this.canvas = canvas;
        this.device = device;
        this.camera = camera;

        const rect = canvas.getBoundingClientRect();
        const w  = rect.width;
        const h = rect.height;

        this.rotationBox = new RotationBox(this,{
            x: w - w / 1.5, y: 0,
            width: w / 1.5,
            height: h
        });

        this.setupEventListeners();
    }

    /**
     * Setup Event Listeners
     */
    private setupEventListeners(): void {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mousePos.x = e.clientX - rect.left;
            this.mousePos.y = e.clientY - rect.top;

            this.isMouseInRotationBox =
                this.mousePos.x >= this.rotationBox.x &&
                this.mousePos.x <= this.rotationBox.x + this.rotationBox.width &&
                this.mousePos.y >= this.rotationBox.y &&
                this.mousePos.y <= this.rotationBox.y + this.rotationBox.height;
        });
        this.canvas.addEventListener('mouseleave', () => {
            this.isMouseInRotationBox = false;
        });
        window.addEventListener('resize', () => {
            const rect = this.canvas.getBoundingClientRect();
            const w = rect.width;
            const h = rect.height;
            this.rotationBox.x = w - w / 1.5;
            this.rotationBox.y = 0;
            this.rotationBox.width = w / 1.5;
            this.rotationBox.height = h;
        });
    }

    /**
     * Get Normalized Mouse Position
     */
    public getNormalizedMousePos(): { x: number, y: number } {
        if(!this.isMouseInRotationBox) return { x: 0.5, y: 0.5 };

        const normX = (this.mousePos.x - this.rotationBox.x) / this.rotationBox.width;
        const normY = (this.mousePos.y - this.rotationBox.y) / this.rotationBox.height;
        return {
            x: Math.max(0, Math.min(1, normX)),
            y: Math.max(0, Math.min(1, normY))
        }
    }

    /**
     * Screen to Rotation
     */
    public screenToRotation(screenX: number, screenY: number): [number, number, number] {
        const maxPitch  = Math.PI / 6;
        const pitch     = -(screenY - 0.5) * maxPitch;
        const maxYaw    = Math.PI / 4;
        const yaw       = -(screenX - 0.5) * maxYaw;
        return [pitch, yaw, 0];
    }

    public getRotationBox(): RotationBox {
        const val = this.rotationBox;
        return val;
    }

    public getRotationBoxCoords(): {
        x: number, y: number,
        width: number, height: number
    } {
        const val = { ...this.rotationBox }
        return val;
    }
}