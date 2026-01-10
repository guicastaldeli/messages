struct Uniforms {
    viewProjection: mat4x4<f32>
};

struct Model {
    matrix: mat4x4<f32>
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<uniform> model: Model;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>
};

@vertex
fn main(
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>
) -> VertexOutput {
    var output: VertexOutput;
    output.position = uniforms.viewProjection * model.matrix * vec4<f32>(position, 1.0);
    output.color = color;
    return output;
}