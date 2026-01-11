import { MeshData, PrimitiveType, VertexLayout } from "@/app/main/renderer/mesh/mesh-data";

export class Stars {
    public static generate(): MeshData {
        const vertices: number[][] = [];
        const indices: number[] = [];

        const minRadius = 30.0;
        const maxRadius = 200.0;
        const count = 2000;

        for(let i = 0; i < count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            const radius = minRadius + Math.random() * (maxRadius - minRadius);
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);
            const brightness = 0.5 + Math.random() * 0.5;

            const baseIndex = vertices.length;
            vertices.push([
                x, y, z,
                0.0, 0.0, 1.0,
                0.0, 0.0,
                brightness, brightness, brightness
            ]);
            vertices.push([
                x, y, z,
                0.0, 0.0, 1.0,
                1.0, 0.0,
                brightness, brightness, brightness
            ]);
            vertices.push([
                x, y, z,
                0.0, 0.0, 1.0,
                1.0, 1.0,
                brightness, brightness, brightness
            ]);
            vertices.push([
                x, y, z,
                0.0, 0.0, 1.0,
                0.0, 1.0,
                brightness, brightness, brightness
            ]);

            indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
            indices.push(baseIndex, baseIndex + 2, baseIndex + 3);
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
            PrimitiveType.TRIANGLE_LIST
        );
    }
}