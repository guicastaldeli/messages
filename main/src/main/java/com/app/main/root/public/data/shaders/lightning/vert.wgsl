struct Uniforms {
    viewProjection: mat4x4<f32>,
    cameraPosition: vec3<f32>,
    padding: f32
}

struct Model {
    matrix: mat4x4<f32>
}

struct DirectionalLight {
    direction: vec3<f32>,
    intensity: f32,
    color: vec3<f32>,
    padding: f32
}

struct AmbientLight {
    color: vec3<f32>,
    intensity: f32
}

struct Lightning {
    ambient: AmbientLight,
    directional: DirectionalLight,
    lightCount: i32,
    padding: vec3<f32>
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<uniform> model: Model;
@group(1) @binding(0) var<uniform> lightning: Lightning;

@vertex
fn main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let worldPos = (model.matrix * vec4<f32>(input.position, 1.0)).xyz;
    let worldNormal = normal((model.matrix * vec4<f32>(input.normal), 0.0)).xyz;

    output.position = uniforms.viewProjection * vec4<f32>(worldPos, 1.0);
    output.texCoord = input.texCoord;
    output.worldPos = worldPos;
    output.color = input.color;
    output.normal = input.normal;
    output.worldNormal = worldNormal;

    return output;
}