struct Camera {
    viewProj: mat4x4<f32>,
    position: vec3<f32>,
    padding: f32,
    time: f32,
    padding2: vec3<f32>
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
    @location(0) color: vec3<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) starSeed: f32
}

@vertex
fn main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    
    let starSize = 2.0;
    
    let viewDir = normalize(camera.position - input.position);
    
    let right = normalize(cross(vec3<f32>(0.0, 1.0, 0.0), viewDir));
    let up = normalize(cross(viewDir, right));
    let offset = (input.texcoord - vec2<f32>(0.5, 0.5)) * starSize;
    
    let billboardPos = input.position + right * offset.x + up * offset.y;
    let worldPos = model.matrix * vec4<f32>(billboardPos, 1.0);
    output.position = camera.viewProj * worldPos;
    output.color = input.color;
    output.uv = input.texcoord;

    output.starSeed = input.position.x + input.position.y * 100.0 + input.position.z;
    
    return output;
}