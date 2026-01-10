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
    
    for(let col = 0; col < 4; col++) {
        for(let row = 0; row < 4; row++) {
            res[col * 4 + row] = 
                a[0 * 4 + row] * b[col * 4 + 0] +
                a[1 * 4 + row] * b[col * 4 + 1] +
                a[2 * 4 + row] * b[col * 4 + 2] +
                a[3 * 4 + row] * b[col * 4 + 3];
        }
    }
    
    return res;
}
}