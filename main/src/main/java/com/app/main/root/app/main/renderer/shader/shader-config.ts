interface Type {
    vertexBufferLayouts: GPUVertexBufferLayout[];
    depthStencil: GPUDepthStencilState;
    primitiveState: GPUPrimitiveState;
    bindGroupLayout: GPUBindGroupLayoutDescriptor;
}

export class ShaderConfig {
    private static instance: ShaderConfig;
    public data: Type;

    private constructor() {
        const vertexBufferLayouts: GPUVertexBufferLayout[] = [{
            arrayStride: 11 * 4,
            attributes: [
                {
                    format: 'float32x3' as const,
                    offset: 0,
                    shaderLocation: 0
                },
                {
                    format: 'float32x3' as const,
                    offset: 3 * 4,
                    shaderLocation: 1
                },
                {
                    format: 'float32x2' as const,
                    offset: 6 * 4,
                    shaderLocation: 2
                },
                {
                    format: 'float32x3' as const,
                    offset: 8 * 4,
                    shaderLocation: 3
                }
            ]
        }];

        const depthStencil: GPUDepthStencilState = {
            depthWriteEnabled: true,
            depthCompare: 'less' as const,
            format: 'depth24plus-stencil8' as const
        }
        
        const primitiveState: GPUPrimitiveState = {
            topology: 'triangle-list',
            cullMode: 'none',
            frontFace: 'ccw'
        };

        const bindGroupLayout: GPUBindGroupLayoutDescriptor = {
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' as const }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform' as const }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' as const }
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: 'float' as const }
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: 'filtering' as const }
                }
            ]
        };

        this.data = {
            vertexBufferLayouts,
            depthStencil,
            primitiveState,
            bindGroupLayout
        }
    }

    public static getInstance(): ShaderConfig {
        if(!ShaderConfig.instance) {
            ShaderConfig.instance = new ShaderConfig();
        }
        return ShaderConfig.instance;
    }
    
    public static get(): Type {
        return ShaderConfig.getInstance().data;
    }
}