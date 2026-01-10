interface Type {
    vertexBufferLayouts: GPUVertexBufferLayout[];
    depthStencil: GPUDepthStencilState;
    primitiveState: GPUPrimitiveState;
}

export class ShaderConfig {
    private static instance: ShaderConfig;
    public data: Type;

    private constructor() {
        const vertexBufferLayouts: GPUVertexBufferLayout[] = [{
            arrayStride: 8 * 4,
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
            cullMode: 'back',
            frontFace: 'ccw'
        };

        this.data = {
            vertexBufferLayouts,
            depthStencil,
            primitiveState
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