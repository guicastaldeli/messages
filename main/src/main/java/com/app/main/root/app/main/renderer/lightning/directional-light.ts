export class DirectionalLight {
    private direction: [number, number, number] = [-12.0, 0.0, -10.0];
    private color: [number, number, number] = [1.0, 1.0, 1.0];
    private intensity: number = 1.0;

    public getData(): Float32Array {
        return new Float32Array([
            ...this.direction,
            this.intensity,
            ...this.color
        ]);
    }
}