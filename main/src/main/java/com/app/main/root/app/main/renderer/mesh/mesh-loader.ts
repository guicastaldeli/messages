import { Mesh, PrimitiveType, MeshData, Type } from "./mesh-data";

export class MeshLoader {
    private static readonly URL = './data/mesh/'; 
    private static loadedMeshes: Map<string, MeshData> = new Map();

    public static getMesh(name: Type): MeshData | undefined {
        return this.loadedMeshes.get(name);
    }

    public static getLoadedMeshes(): string[] {
        return Array.from(this.loadedMeshes.keys());
    }
    
    /**
     * 
     * Load
     * 
     */
    public static async load(): Promise<MeshData> {
        try {
            const res = await fetch(MeshLoader.URL);
            if(!res.ok) throw new Error(`Failed to load mesh: ${res.statusText}`);
            
            const data: Mesh = await res.json();
            if(!data.vertices || !data.indices || !data.vertexLayout) {
                throw new Error('Invalid mesh structure!');
            }

            const meshData = new MeshData(
                data.name,
                data.vertices,
                data.indices,
                data.vertexLayout,
                data.primitiveType || PrimitiveType.TRIANGLE_LIST
            );

            this.loadedMeshes.set(data.name, meshData);
            console.log(`Loaded mesh: ${data.name}`);

            return meshData;
        } catch(err) {
            console.error(`ERROR loading mesh! ${MeshLoader.URL}`, err);
            throw err;
        }
    }
}