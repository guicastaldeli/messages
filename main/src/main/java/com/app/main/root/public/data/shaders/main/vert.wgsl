struct Uniforms {
    viewProjection: mat4x4<f32>,
    cameraPosition: vec3<f32>,
    padding: f32
}

struct Model {
    matrix: mat4x4<f32>
}

struct Material {
    useTexture: f32,
    padding: vec3<f32>
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<uniform> model: Model;
@group(0) @binding(2) var<uniform> material: Material;
@group(0) @binding(3) var baseColorTexture: texture_2d<f32>;
@group(0) @binding(4) var textureSampler: sampler;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) texCoord: vec2<f32>,
    @location(3) color: vec3<f32>
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) texCoord: vec2<f32>,
    @location(1) worldPos: vec3<f32>,
    @location(2) color: vec3<f32>,
    @location(3) normal: vec3<f32> 
};

@vertex
fn main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let worldPos = (model.matrix * vec4<f32>(input.position, 1.0)).xyz;
    output.position = uniforms.viewProjection * vec4<f32>(worldPos, 1.0);
    output.texCoord = input.texCoord;
    output.worldPos = worldPos;
    output.color = input.color;
    return output;
}