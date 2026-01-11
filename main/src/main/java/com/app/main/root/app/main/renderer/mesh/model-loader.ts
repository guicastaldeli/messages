import { MeshData, PrimitiveType, Type, VertexLayout } from "./mesh-data";

export class ModelLoader {
    public static readonly URL = './data/resource/obj/'; 

    /**
     * Parse
     */
    public static parse(objText: string, modelType: Type): MeshData[] {
        const lines = objText.split('\n');

        const vertices: number[][] = [];
        const normals: number[][] = [];
        const texCoords: number[][] = [];

        const meshes: {
            type: string,
            vertices: number[][],
            indices: number[],
            vertexMap: Map<string, number>
        }[] = [];

        let currentMesh: {
            type: string,
            vertices: number[][],
            indices: number[],
            vertexMap: Map<string, number>
        } | null = null;

        for(let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if(!line || line.startsWith('#')) continue;

            const parts = line.split(/\s+/);
            const keyword = parts[0];

            switch (keyword) {
                case 'v':
                    const vertex = [
                        parseFloat(parts[1]),
                        parseFloat(parts[2]),
                        parseFloat(parts[3])
                    ];
                    if(parts.length > 4) vertex.push(parseFloat(parts[4]));
                    vertices.push(vertex);
                    break;
                    
                case 'vt':
                    texCoords.push([
                        parseFloat(parts[1]),
                        parseFloat(parts[2]),
                        parts[3] ? parseFloat(parts[3]) : 0
                    ]);
                    break;
                    
                case 'vn': 
                    normals.push([
                        parseFloat(parts[1]),
                        parseFloat(parts[2]),
                        parseFloat(parts[3])
                    ]);
                    break;
                    
                case 'o':
                case 'g':
                    if(currentMesh && currentMesh.vertices.length > 0) {
                        meshes.push(currentMesh);
                    }
                    currentMesh = {
                        type: parts.slice(1).join(' ') || `${modelType}_mesh_${meshes.length}`,
                        vertices: [],
                        indices: [],
                        vertexMap: new Map()
                    };
                    break;
                    
                case 'f':
                    if(!currentMesh) {
                        currentMesh = {
                            type: `${modelType}_default`,
                            vertices: [],
                            indices: [],
                            vertexMap: new Map()
                        };
                    }
                    
                    const faceIndices = parts.slice(1).map(part => {
                        const indices = part.split('/');
                        let v = parseInt(indices[0]);
                        let vt = indices[1] ? parseInt(indices[1]) : 0;
                        let vn = indices[2] ? parseInt(indices[2]) : 0;
                        
                        if(v < 0) v = vertices.length + v + 1;
                        if(vt < 0) vt = texCoords.length + vt + 1;
                        if(vn < 0) vn = normals.length + vn + 1;
                        
                        return {
                            v: v - 1,
                            vt: vt - 1,
                            vn: vn - 1
                        };
                    });
                    
                    let faceNormal: number[] | null = null;
                    if(normals.length === 0 || faceIndices.every(fi => fi.vn < 0)) {
                        faceNormal = this.calculateFaceNormal(
                            vertices,
                            faceIndices[0].v,
                            faceIndices[1].v,
                            faceIndices[2].v
                        );
                    }
                    
                    for(let j = 1; j < faceIndices.length - 1; j++) {
                        const v0 = faceIndices[0];
                        const v1 = faceIndices[j];
                        const v2 = faceIndices[j + 1];
                        
                        const idx0 = this.addVertex(currentMesh, vertices, normals, texCoords, v0, faceNormal);
                        const idx1 = this.addVertex(currentMesh, vertices, normals, texCoords, v1, faceNormal);
                        const idx2 = this.addVertex(currentMesh, vertices, normals, texCoords, v2, faceNormal);
                        
                        currentMesh.indices.push(idx0, idx1, idx2);
                    }
                    break;
            }
        }

        if(currentMesh && currentMesh.vertices.length > 0) {
            meshes.push(currentMesh);
        }

        const meshDataList: MeshData[] = [];
        for(const mesh of meshes) {
            const meshData = this.createMeshData(mesh, modelType);
            meshDataList.push(meshData);
        }

        return meshDataList;
    }

    /**
     * Calculate Face Normal
     */
    private static calculateFaceNormal(
        vertices: number[][],
        i0: number,
        i1: number,
        i2: number
    ): number[] {
        if(i0 < 0 || i0 >= vertices.length ||
           i1 < 0 || i1 >= vertices.length ||
           i2 < 0 || i2 >= vertices.length) {
            return [0, 1, 0];
        }

        const v0 = vertices[i0];
        const v1 = vertices[i1];
        const v2 = vertices[i2];

        const edge1 = [
            v1[0] - v0[0],
            v1[1] - v0[1],
            v1[2] - v0[2]
        ];
        const edge2 = [
            v2[0] - v0[0],
            v2[1] - v0[1],
            v2[2] - v0[2]
        ];

        const normal = [
            edge1[1] * edge2[2] - edge1[2] * edge2[1],
            edge1[2] * edge2[0] - edge1[0] * edge2[2],
            edge1[0] * edge2[1] - edge1[1] * edge2[0]
        ];

        const length = Math.sqrt(
            normal[0] * normal[0] +
            normal[1] * normal[1] +
            normal[2] * normal[2]
        );

        if(length > 0.00001) {
            normal[0] /= length;
            normal[1] /= length;
            normal[2] /= length;
        } else {
            return [0, 1, 0];
        }

        return normal;
    }

    /**
     * Add Vertex
     */
    private static addVertex(
        mesh: { 
            vertices: number[][], 
            indices: number[],
            vertexMap: Map<string, number>
        },
        vertices: number[][],
        normals: number[][],
        texCoords: number[][],
        indices: { 
            v: number, 
            vt: number, 
            vn: number 
        },
        faceNormal: number[] | null
    ): number {
        const key = `${indices.v}/${indices.vt}/${indices.vn}`;
        
        const existingIndex = mesh.vertexMap.get(key);
        if(existingIndex !== undefined) {
            return existingIndex;
        }

        const vertexData: number[] = [];


        if(indices.v >= 0 && indices.v < vertices.length) {
            vertexData.push(...vertices[indices.v]);
        } else {
            vertexData.push(0, 0, 0);
        }
        if(indices.vn >= 0 && indices.vn < normals.length) {
            vertexData.push(...normals[indices.vn]);
        } else if(faceNormal) {
            vertexData.push(...faceNormal);
        } else {
            vertexData.push(0, 1, 0);
        }
        if(indices.vt >= 0 && indices.vt < texCoords.length) {
            vertexData.push(texCoords[indices.vt][0], texCoords[indices.vt][1]);
        } else {
            vertexData.push(0, 0);
        }
        vertexData.push(1.0, 1.0, 1.0);
        
        const newIndex = mesh.vertices.length;
        mesh.vertices.push(vertexData);
        mesh.vertexMap.set(key, newIndex);
        
        return newIndex;
    }

    /**
     * Create Mesh Data
     */
    private static createMeshData(
        objMesh: {
            type: string,
            vertices: number[][],
            indices: number[]
        },
        modelType: string
    ): MeshData {
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
        };

        return new MeshData(
            `${modelType}_${objMesh.type}`,
            objMesh.vertices,
            objMesh.indices,
            vertexLayout,
            PrimitiveType.TRIANGLE_LIST
        );
    }
}