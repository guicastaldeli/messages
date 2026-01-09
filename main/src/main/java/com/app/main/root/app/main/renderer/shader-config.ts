interface Type {
    vertexBufferLayouts: GPUVertexBufferLayout[];
    depthStencil: GPUDepthStencilState
}
export class ShaderConfig {
    private static instance: ShaderConfig;
    public data: Type;

    private constructor() {
        const vertexBufferLayouts: GPUVertexBufferLayout[] = [{
            arrayStride: 20,
            attributes: [
                {
                    format: 'float32x2' as const,
                    offset: 0,
                    shaderLocation: 0
                },
                {
                    format: 'float32x3' as const,
                    offset: 8,
                    shaderLocation: 1
                }
            ]
        }];

        const depthStencil: GPUDepthStencilState = {
            depthWriteEnabled: true,
            depthCompare: 'less' as const,
            format: 'depth24plus-stencil8' as const
        }

        this.data = {
            vertexBufferLayouts,
            depthStencil
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