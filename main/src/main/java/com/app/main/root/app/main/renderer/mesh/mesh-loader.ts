import { Stars } from "@/public/data/mesh/stars";
import { Mesh, PrimitiveType, MeshData, Type } from "./mesh-data";
import { ModelLoader } from "./model-loader";
import { Sphere } from "@/public/data/mesh/sphere";
import { Clouds } from "@/public/data/mesh/clouds";
import { Fresnel } from "@/public/data/mesh/fresnel";

export class MeshLoader {
    private static readonly URL = './data/mesh/'; 
    private static loadedMeshes: Map<string, MeshData> = new Map();

    public static getMesh(name: Type): MeshData | undefined {
        return this.loadedMeshes.get(name);
    }

    public static getLoadedMeshes(): string[] {
        return Array.from(this.loadedMeshes.keys());
    }

    private static async checkFileExists(url: string): Promise<boolean> {
        try {
            const res = await fetch(url, { method: 'HEAD' });
            return res.ok;
        } catch {
            return false;
        }
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
                if(t === Type.STARS || 
                    t === Type.SPHERE || 
                    t === Type.CLOUDS ||
                    t === Type.FRESNEL
                ) {
                    return await this.loadFile(t);
                }

                const url = `${MeshLoader.URL}${t}.json`;
                const meshExists = await this.checkFileExists(url);
                if(meshExists) {
                    const loaded = await this.loadMesh(t);
                    if(loaded) return loaded;
                }
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
            if(t === Type.STARS) {
                const data = Stars.generate();
                this.loadedMeshes.set(t, data);
                return data;
            }
            if(t === Type.SPHERE) {
                const data = Sphere.generate();
                this.loadedMeshes.set(t, data);
                return data;
            }
            if(t === Type.CLOUDS) {
                const data = Clouds.generate();
                this.loadedMeshes.set(t, data);
                return data;
            }
            if(t === Type.FRESNEL) {
                const data = Fresnel.generate();
                this.loadedMeshes.set(t, data);
                return data;
            }

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

    private static async loadFile(t: Type): Promise<MeshData> {
        try {
            let meshData: MeshData;
            switch(t) {
                case Type.STARS:
                    meshData = Stars.generate();
                    break;
                case Type.SPHERE:
                    meshData = Sphere.generate();
                    break;
                case Type.CLOUDS:
                    meshData = Clouds.generate();
                    break;
                case Type.FRESNEL:
                    meshData = Fresnel.generate();
                    break;
                default:
                    throw new Error(`No generator for type: ${t}`);
            }
            
            this.loadedMeshes.set(t, meshData);
            console.log(`Generated procedural mesh: ${t}`);
            return meshData;
        } catch(err) {
            console.error(`Failed to generate mesh ${t}:`, err);
            throw err;
        }
    }
}