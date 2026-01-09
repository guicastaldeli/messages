export enum ShaderType {
    VERT = 'vertex',
    FRAG = 'fragment',
    COMPUTE = 'compute'
}

export enum ShaderStage {
    VERT = 'vert',
    FRAG = 'frag',
    COMPUTE = 'compute'
}

export interface ShaderDef {
    path: string;
    type: ShaderType;
    name: string;
}

export interface ShaderProgram {
    name: string;
    vert: string;
    frag: string;
    compute?: string;
}

export const ShaderPaths = {
    MAIN: {
        name: 'main',
        vert: 'main/vert.wgsl',
        frag: 'main/frag.wgsl'
    },
    LIGHTNING: {
        name: 'lightning',
        vert: 'lightning/vert.wgsl',
        frag: 'lightning/frag.wgsl'
    },
    SKYBOX: {
        name: 'skybox',
        vert: 'skybox/vert.wgsl',
        frag: 'skybox/frag.wgsl'
    }
} as const;

export type ShaderProgramName = keyof typeof ShaderPaths;
export type ShaderProgramDef = typeof ShaderPaths[ShaderProgramName];