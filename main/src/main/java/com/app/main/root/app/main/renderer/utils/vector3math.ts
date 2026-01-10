export class Vector3Math {
    private static instance: Vector3Math;

    public static getInstance(): Vector3Math {
        if(!Vector3Math.instance) {
            Vector3Math.instance = new Vector3Math();
        }
        return Vector3Math.instance;
    }

    /**
     * Normalize
     */
    public static normalize(v: [number, number, number]): [number, number, number] {
        const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
        if(len == 0) return [0, 0, 0];
        return [v[0]/len, v[1]/len, v[2]/len];
    }

    /**
     * Cross
     */
    public static cross(
        a: [number, number, number],
        b: [number, number, number]
    ): [number, number, number] {
        return [
            a[1]*b[2] - a[2]*b[1],
            a[2]*b[0] - a[0]*b[2],
            a[0]*b[1] - a[1]*b[0]
        ];
    }

    /**
     * Dot
     */
    public static dot(
        a: [number, number, number],
        b: [number, number, number]
    ): number {
        return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
    }

    /**
     * Multiply Matrices
     */
    public static multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array {
        const res = new Float32Array(16);
        for(let i = 0; i < 4; i++) {
            for(let j = 0; j < 4; j++) {
                res[i * 4 + j] = 0;
                for(let k = 0; k < 4; k++) {
                    res[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k];
                }
            }
        }
        return res;
    }
}