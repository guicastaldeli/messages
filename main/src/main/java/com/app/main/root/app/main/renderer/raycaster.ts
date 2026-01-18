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

        this.rotationBox = new RotationBox(
            this,
            {
                x: this.canvas.width - (this.canvas.width / 1.5),
                y: 0,
                width: this.canvas.width / 1.5,
                height: this.canvas.height
            }
        );

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
    }

    /**
     * Get Normalized Mouse Position
     */
    public getNormalizedMousePos(): { x: number, y: number } {
        if(!this.isMouseInRotationBox) {
            return { x: 0.5, y: 0.5 }
        }

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
        const rotationX = (screenX - 0.5) * Math.PI;
        const rotationY = (screenY - 0.5) * Math.PI;
        return [rotationX, rotationY, 0];
    }

    public getRotationBox(): RotationBox {
        return this.rotationBox
    }

    public getRotationBoxCoords(): {
        x: number,
        y: number,
        width: number,
        height: number
    } {
        return { ...this.rotationBox }
    }
}