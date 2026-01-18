import { MeshData, PrimitiveType, VertexLayout } from "@/app/main/renderer/mesh/mesh-data";

export class Fresnel {
    public static set(data: any, isFresnel: boolean): { isFresnel: boolean } {
        if(data.name.includes('fresnel')) {
            isFresnel = true;
        } else {
            isFresnel = false;
        }
        return { isFresnel }
    }

    public static generate(): MeshData {
        const vertices: number[][] = [];
        const indices: number[] = [];

        const segments = 16;
        const rings = 16;

        for(let ring = 0; ring <= rings; ring++) {
            const theta = ring * Math.PI / rings;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);
            
            for(let segment = 0; segment <= segments; segment++) {
                const phi = segment * 2 * Math.PI / segments;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);
                
                const x = cosPhi * sinTheta * 0.5;
                const y = cosTheta * 0.5;
                const z = sinPhi * sinTheta * 0.5;
                
                const nx = cosPhi * sinTheta;
                const ny = cosTheta;
                const nz = sinPhi * sinTheta;
                
                const u = segment / segments;
                const v = 1.0 - (ring / rings);
                
                const r = (x + 0.5);
                const g = (y + 0.5);
                const b = (z + 0.5);
                
                vertices.push([
                    x, y, z, 
                    nx, ny, nz, 
                    u, v, 
                    r, g, b
                ]);
            }
        }
        
        for(let ring = 0; ring < rings; ring++) {
            for(let segment = 0; segment < segments; segment++) {
                const first = (ring * (segments + 1)) + segment;
                const second = first + segments + 1;
                
                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }

        const vertexLayout: VertexLayout = {
            stride: 11,
            attributes: [
                {
                    name: "position",
                    components: 3,
                    offset: 0,
                    type: "float32"
                },
                {
                    name: "normal",
                    components: 3,
                    offset: 3,
                    type: "float32"
                },
                {
                    name: "texcoord",
                    components: 2,
                    offset: 6,
                    type: "float32"
                },
                {
                    name: "color",
                    components: 3,
                    offset: 8,
                    type: "float32"
                }
            ]
        };
        
        return new MeshData(
            'fresnel',
            vertices,
            indices,
            vertexLayout,
            PrimitiveType.TRIANGLE_LIST
        );
    }
}