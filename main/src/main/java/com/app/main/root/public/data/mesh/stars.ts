import { MeshData, PrimitiveType, VertexLayout } from "@/app/main/renderer/mesh/mesh-data";

export class Stars {
    public static generate(): MeshData {
        const vertices: number[][] = [];
        const indices: number[] = [];

        const radius = 400.0;
        const count = 1000.0;

        for(let i = 0; i < count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);
            const brightness = 0.5 + Math.random() * 0.5;

            vertices.push([
                x, y, z,
                0.0, 0.0, 1.0,
                0.0, 0.0,
                brightness, brightness, brightness
            ]);

            indices.push(i);
        }

        const vertexLayout: VertexLayout = {
            stride: 11,
            attributes: [
                {
                    name: 'position',
                    components: 3,
                    offset: 0,
                    type: 'float32'
                },
                {
                    name: 'normal',
                    components: 3,
                    offset: 3,
                    type: 'float32'
                },
                {
                    name: 'texcoord',
                    components: 2,
                    offset: 6,
                    type: 'float32'
                },
                {
                    name: 'color',
                    components: 3,
                    offset: 8,
                    type: 'float32'
                }
            ]
        }

        return new MeshData(
            'stars',
            vertices,
            indices,
            vertexLayout,
            PrimitiveType.POINT_LIST
        );
    }
}