export class Transform {
    public position: [number, number, number] = [0.0, 0.0, 0.0];
    public rotation: [number, number, number] = [0.0, 0.0, 0.0];
    public scale: [number, number, number] = [1.0, 1.0, 1.0];

    constructor(
        position?: [number, number, number],
        rotation?: [number, number, number],
        scale?: [number, number, number]
    ) {
        if(position) this.position = position;
        if(rotation) this.rotation = rotation;
        if(scale) this.scale = scale;
    }

    public setPosition(
        x: number,
        y: number,
        z: number
    ): void {
        this.position = [x, y, z];
    }

    public setRotation(
        x: number, 
        y: number, 
        z: number
    ): void {
        this.rotation = [x, y, z];
    }

    public setScale(
        x: number,
        y: number,
        z: number
    ): void {
        this.scale = [x, y, z];
    }

    public translate(dx: number, dy: number, dz: number): void {
        this.position[0] += dx;
        this.position[1] += dy;
        this.position[2] += dz;
    }

    public rotate(dx: number, dy: number, dz: number): void {
        this.rotation[0] += dx;
        this.rotation[1] += dy;
        this.rotation[2] += dz;
    }

    public getModelMatrix(): Float32Array {
        const [px, py, pz] = this.position;
        const [rx, ry, rz] = this.rotation;
        const [sx, sy, sz] = this.scale;

        const cosX = Math.cos(rx);
        const cosY = Math.cos(ry);
        const cosZ = Math.cos(rz);

        const sinX = Math.sin(rx);
        const sinY = Math.sin(ry);
        const sinZ = Math.sin(rz);

        const matrix = new Float32Array(16);

        matrix[0] = sx * (cosY * cosZ);
        matrix[1] = sx * (cosY * sinZ);
        matrix[2] = sx * (-sinY);
        matrix[3] = 0;

        matrix[4] = sy * (sinX * sinY * cosZ - cosX * sinZ);
        matrix[5] = sy * (sinX * sinY * sinZ + cosX * cosZ);
        matrix[6] = sy * (sinX * cosY);
        matrix[7] = 0;

        matrix[8] = sz * (cosX * sinY * cosZ + sinX * sinZ);
        matrix[9] = sz * (cosX * sinY * sinZ - sinX * cosZ);
        matrix[10] = sz * (cosX * cosY);
        matrix[11] = 0;

        matrix[12] = px;
        matrix[13] = py;
        matrix[14] = pz;
        matrix[15] = 1;

        return matrix;
    }
}