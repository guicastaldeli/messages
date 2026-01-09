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
    public static async load(): Promise<void> {
        try {
            const meshTypes: Type[] = Object.values(Type) as Type[];
            console.log(`Loading ${meshTypes.length} mesh types:`, meshTypes);

            const loadPromises = meshTypes.map(async (t) => {
                const url = `${MeshLoader.URL}${t.toLowerCase()}.json`;
                const res = await fetch(url);
                if(!res.ok) throw new Error(`Failed to load mesh: ${res.statusText}`);
                
                const data: Mesh = await res.json();
                if(!data.vertices || !data.indices || !data.vertexLayout) {
                    throw new Error(`Invalid mesh ${data.name} structure!`);
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
            })

            await Promise.all(loadPromises);
            console.log(`Mesh loading completed. Loaded ${this.loadedMeshes.size} meshes`);
        } catch(err) {
            console.error(`ERROR loading mesh! ${MeshLoader.URL}`, err);
            throw err;
        }
    }
}