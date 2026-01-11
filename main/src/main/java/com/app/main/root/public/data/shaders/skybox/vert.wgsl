struct Camera {
    viewProj: mat4x4<f32>,
    position: vec3<f32>,
    padding: f32
}

struct Model {
    matrix: mat4x4<f32>
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> model: Model;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) texcoord: vec2<f32>,
    @location(3) color: vec3<f32>
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>
}

@vertex
fn main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let worldPos = model.matrix * vec4<f32>(input.position, 1.0);
    output.position = camera.viewProj * worldPos;

    output.color = input.color;

    return output;
}