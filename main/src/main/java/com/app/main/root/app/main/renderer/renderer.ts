export class Renderer {
    private canvas: HTMLCanvasElement | null = null;
    private ctx: GPUCanvasContext | null = null;
    private device: GPUDevice | null = null;

    constructor() {
        
    }

    public async setup(canvasId: string): Promise<void> {
        this.canvas = document.querySelector(`#${canvasId}`);
        if(!this.canvas) throw new Error('Canvas err');

        this.ctx = this.canvas.getContext('webgpu');
        if(!this.ctx) throw new Error('webgpu err');

        const adapter = await navigator.gpu.requestAdapter();
        if(!adapter) throw new Error('No adapter found!');

        this.device = await adapter.requestDevice();
        if(!this.device) throw new Error('No device found!');

        this.ctx?.configure({
            device: this.device,
            format: navigator.gpu.getPreferredCanvasFormat(),
            alphaMode: "premultiplied"
        });
    }

    public async render(): Promise<void> {
        if(!this.device || !this.ctx) return;

        const commandEncoder = this.device.createCommandEncoder();
        const texView = this.ctx.getCurrentTexture().createView();

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: texView,
                clearValue: { r: 0.5, g: 0.5, b: 0.5, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        });
        renderPass.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }
}