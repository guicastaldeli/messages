import { Mesh, PrimitiveType, MeshData, Type } from "./mesh-data";
import { ModelLoader } from "./model-loader";

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
                const loaded = await this.loadMesh(t);
                if(loaded) return loaded;
                return await this.loadObj(t);
            });

            await Promise.all(loadPromises);
            console.log(`Mesh loading completed. Loaded ${this.loadedMeshes.size} meshes`);
        } catch(err) {
            console.error(`ERROR loading mesh! ${MeshLoader.URL}`, err);
            throw err;
        }
    }

    private static async loadMesh(t: Type): Promise<MeshData | null> {
        try {
            const type = t.toLowerCase();
            const url = `${MeshLoader.URL}${type}.json`;
            const res = await fetch(url);
            if(!res.ok) return null;

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
            
            this.loadedMeshes.set(t, meshData);
            console.log(`Loaded mesh: ${data.name}`);
            return meshData;    
        } catch(err) {
            return null;
        }
    }

    private static async loadObj(t: Type): Promise<MeshData> {
        try {
            const url = `${ModelLoader.URL}${t.toLowerCase()}.obj`;
            const res = await fetch(url);
            if(!res.ok) throw new Error(`Failed to load ${res.statusText}`);
    
            const objText = await res.text();
            const meshDataList = ModelLoader.parse(objText, t);
            if(meshDataList.length === 0) throw new Error(`No mesh found ${t}`);
    
            const meshData = meshDataList[0];
            this.loadedMeshes.set(t, meshData);
            console.log(`Loaded model: ${t} with ${meshDataList.length} meshes`);
            return meshData;
        } catch(err) {
            console.error(`Failed to load ${t}:`, err);
            throw new Error(`Could not load model for type: ${t}`);
        }
    }
}