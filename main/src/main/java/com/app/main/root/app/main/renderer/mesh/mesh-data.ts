export enum PrimitiveType {
    TRIANGLE_LIST = 'triangle-list',
    TRIANGLE_STRIP = 'triangle-strip',
    LINE_LIST = 'line-list',
    POINT_LIST = 'point-list'
}

export enum Type {
    CUBE = 'cube',
    SPHERE = 'sphere',
    PYRAMID = 'pyramid',
    TREE = 'tree0'
}

type AttrType = 
    'float32' | 
    'uint32' | 
    'sint32' | 
    'uint16' | 
    'sint16' | 
    'uint8' | 
    'sint8';

export interface VertexAttribute {
    name: string;
    components: number;
    offset: number;
    type: AttrType;
}

export interface VertexLayout {
    stride: number;
    attributes: VertexAttribute[];
}

export interface Mesh {
    name: string;
    type: string;
    vertices: number[][];
    indices: number[];
    vertexLayout: VertexLayout;
    primitiveType: PrimitiveType;
}

export interface ModelData {
    name: string;
}

export class MeshData {
    private static meshes: Map<string, MeshData> = new Map();

    public name: string;
    public vertices: Float32Array;
    public indices: Uint32Array | Uint16Array;
    public vertexLayout: VertexLayout;
    public primitiveType: PrimitiveType;
    public vertexBufferLayout: GPUVertexBufferLayout;

    constructor(
        name: string,
        vertices: number[][],
        indices: number[],
        vertexLayout: VertexLayout,
        primitiveType: PrimitiveType = PrimitiveType.TRIANGLE_LIST
    ) {
        this.name = name;
        this.vertexLayout = vertexLayout;
        this.primitiveType = primitiveType;

        const flatVertices: number[] = [];
        vertices.forEach(v => {
            flatVertices.push(...v);
        });
        this.vertices = new Float32Array(flatVertices);

        if(indices.some(idx => idx > 65535)) {
            this.indices = new Uint32Array(indices);
        } else {
            this.indices = new Uint16Array(indices);
        }

        this.vertexBufferLayout = this.createVertexBufferLayout(vertexLayout);
        MeshData.meshes.set(name, this);
    }

    public static get(type: Type): MeshData | undefined {
        return MeshData.meshes.get(type);
    }

    public static getAll(): MeshData[] {
        return Array.from(MeshData.meshes.values());
    } 

    /**
     * Vertex Count
     */
    public getVertexCount(): number {
        return this.vertices.length / this.vertexLayout.stride;
    }

    /**
     * Index Count
     */
    public getIndexCount(): number {
        return this.indices.length;
    }

    /**
     * Vertex Buffer Size
     */
    public getVertexBufferSize(): number {
        return this.vertices.byteLength;
    }

    /**
     * Indices Buffer Size
     */
    public getIndexBufferSize(): number {
        return this.indices.byteLength;
    }

    /**
     * Create Vertex Buffer Layout
     */
    private createVertexBufferLayout(layout: VertexLayout): GPUVertexBufferLayout {
        const attributes: GPUVertexAttribute[] = [];
        let currShaderLocation = 0;
        const sortedAttr = [...layout.attributes].sort((a, b) => a.offset - b.offset);
        for(const attr of sortedAttr) {
            const format = this.getVertexFormat(attr.components, attr.type);
            attributes.push({
                format: format,
                offset: attr.offset * 4,
                shaderLocation: currShaderLocation++
            });
        }

        return {
            arrayStride: layout.stride * 4,
            stepMode: 'vertex' as GPUVertexStepMode,
            attributes: attributes
        }
    }

    /**
     * Get Vertex Format
     */
    private getVertexFormat(components: number, type: string): GPUVertexFormat {
        const typeMap: Record<string, string> = {
            'float32': 'float32',
            'uint32': 'uint32',
            'sint32': 'sint32',
            'uint16': 'uint16',
            'sint16': 'sint16',
            'uint8': 'uint8',
            'sint8': 'sint8'
        };
        const baseType = typeMap[type] || 'float32';
        return `${baseType}x${components}` as GPUVertexFormat;
    }
}