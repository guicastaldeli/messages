export class AmbientLight {
    private color: [number, number, number] = [1.0, 1.0, 1.0];
    private intensity: number = 0.1;

    public getData(): Float32Array {
        return new Float32Array([
            ...this.color,
            this.intensity
        ]);
    }
}