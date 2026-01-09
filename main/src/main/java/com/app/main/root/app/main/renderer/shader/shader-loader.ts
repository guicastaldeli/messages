import { ShaderType, ShaderStage, ShaderPaths, ShaderProgramName } from "../shader/shader-path";

export interface ShaderModule {
    code: string;
    module: GPUShaderModule;
    type: ShaderType;
    stage: ShaderStage;
    name: string;
}

export interface ShaderPipeline {
    name: string;
    vert?: ShaderModule;
    frag?: ShaderModule;
    compute?: ShaderModule;
    pipeline?: GPURenderPipeline | GPUComputePipeline;
}

export class ShaderLoader {
    private static readonly PATH: string = './data/shaders/';

    private device: GPUDevice | null = null;
    private shaderCache: Map<String, ShaderModule> = new Map();
    private pipelineCache: Map<string, ShaderPipeline> = new Map();

    private onLoadedCallbacks: ((pipeine: ShaderPipeline) => void)[] = [];
    private onErrorCallbacks: ((err: Error, shaderName: string) => void)[] = [];


    public setDevice(device: GPUDevice): void {
        this.device = device;
        this.recompileAllShaders();
    }

    /**
     * Load
     */
    public async loadShader(
        shaderPath: string,
        type: ShaderType,
        name: string
    ): Promise<ShaderModule> {
        const cacheKey = `${name}:${type}`;
        if(this.shaderCache.has(cacheKey)) return this.shaderCache.get(cacheKey)!;

        try {
            const fullPath = `${ShaderLoader.PATH}${shaderPath}`;
            console.log('Shader loading details:');
        console.log('- Base path:', ShaderLoader.PATH);
        console.log('- Shader path:', shaderPath);
        console.log('- Full path:', fullPath);
        console.log('- Current URL:', window.location.href);
        console.log('- Absolute URL:', new URL(fullPath, window.location.href).href);
            const res = await fetch(fullPath);
            if(!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

            const code = await res.text();
            const module = this.compile(code, name, type);
            const shaderModule: ShaderModule = {
                code,
                module,
                type,
                stage: this.getShaderStage(type),
                name
            }
            
            this.shaderCache.set(cacheKey, shaderModule);
            return shaderModule;
        } catch(err) {
            console.error(`Failed to load shader ${name} from ${shaderPath}:`, err);
            this.emitError(err as Error, name);
            throw err;
        }
    }

    /**
     * Load Program
     */
    public async loadProgram(name: ShaderProgramName): Promise<ShaderPipeline> {
        if(this.pipelineCache.has(name)) return this.pipelineCache.get(name)!;

        const programDef = ShaderPaths[name];
        const pipeline: ShaderPipeline = { name: programDef.name }
        try {
            if('vert' in programDef && 'frag' in programDef) {
                const [vert, frag] = await Promise.all([
                    this.loadShader(programDef.vert, ShaderType.VERT, programDef.name),
                    this.loadShader(programDef.frag, ShaderType.FRAG, programDef.name),
                ]);
                pipeline.vert = vert;
                pipeline.frag = frag;
            } else if('compute' in programDef) {
                /* PS: only use this here if need!!!!!, to future me :)
                const compute = await this.loadShader(
                    programDef.compute,
                    ShaderType.COMPUTE,
                    programDef.name
                );
                pipeline.compute = compute;
                */
            } else {
                throw new Error(`Invalid shader program definition for ${name}`);
            }

            this.pipelineCache.set(name, pipeline);
            this.emitLoaded(pipeline);
            return pipeline;
        } catch(err) {
            console.error(`Failed to load program ${name}`, err);
            this.emitError(err as Error, name);
            throw err;
        }
    }

    public async loadPrograms(names: ShaderProgramName[]): Promise<ShaderPipeline[]> {
        const promises = names.map(name =>
            this.loadProgram(name).catch(err => {
                console.error(`Failed to load program ${name}:`, err);
                return null;
            })
        );
        const res = await Promise.all(promises);
        return res.filter((p): p is ShaderPipeline => p !== null);
    }

    public async preloadAll(): Promise<ShaderPipeline[]> {
        const programNames = Object.keys(ShaderPaths) as ShaderProgramName[];
        return this.loadPrograms(programNames);
    }

    /**
     * Get Pipeline
     */
    public getPipeline(name: ShaderProgramName): ShaderPipeline | undefined {
        return this.pipelineCache.get(name);
    }

    public getPipelines(): ShaderPipeline[] {
        return Array.from(this.pipelineCache.values());
    }

    /**
     * Create Pipeline Layout
     */
    public createPipelineLayout(bindGroupLayouts: GPUBindGroupLayout[] = []): GPUPipelineLayout {
        if(!this.device) throw new Error('Device not init');
        return this.device.createPipelineLayout({ bindGroupLayouts });
    }

    /**
     * Create Render Pipeline
     */
    public createRenderPipeline(
        pipelineName: ShaderProgramName,
        layout: GPUPipelineLayout,
        vertexBuffers: GPUVertexBufferLayout[],
        colorFormats: GPUTextureFormat[],
        depthStencil?: GPUDepthStencilState
    ): GPURenderPipeline {
        if(!this.device) throw new Error('Device not init');

        const shaderPipeline = this.getPipeline(pipelineName);
        if(!shaderPipeline || !shaderPipeline.vert || !shaderPipeline.frag) {
            throw new Error(`Shader Pipeline ${pipelineName} not found`);
        }

        const pipeline = this.device.createRenderPipeline({
            layout,
            vertex: {
                module: shaderPipeline.vert.module,
                entryPoint: 'main',
                buffers: vertexBuffers
            },
            fragment: {
                module: shaderPipeline.frag.module,
                entryPoint: 'main',
                targets: colorFormats.map(format => ({ format }))
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'back'
            },
            depthStencil,
            multisample: {
                count: 1
            }
        });

        shaderPipeline.pipeline = pipeline;
        return pipeline;
    }

    private getShaderStage(type: ShaderType): ShaderStage {
        return type.toLowerCase() as ShaderStage;
    }

    /**
     * Compile
     */
    private compile(
        code: string,
        name: string,
        type: ShaderType
    ): GPUShaderModule {
        if(!this.device) throw new Error('GPUDevice not set!');

        const module = this.device.createShaderModule({
            code,
            label: `${name}_${type}`
        });
        return module;
    }

    private recompileAllShaders(): void {
        if(!this.device) return;

        this.shaderCache.forEach(shader => {
            shader.module = this.compile(
                shader.code,
                shader.name,
                shader.type
            )
        });

        this.pipelineCache.forEach(pipeline => {
            pipeline.pipeline = undefined;
        });
    }

    onLoaded(cb: (pipeline: ShaderPipeline) => void): void {
        this.onLoadedCallbacks.push(cb);
    }

    public onError(cb: (err: Error, shaderName: string) => void): void {
        this.onErrorCallbacks.push(cb);
    }

    private emitLoaded(pipeline: ShaderPipeline): void {
        this.onLoadedCallbacks.forEach(cb => cb(pipeline));
    }

    private emitError(err: Error, shaderName: string): void {
        this.onErrorCallbacks.forEach(cb => cb(err, shaderName));
    }
}