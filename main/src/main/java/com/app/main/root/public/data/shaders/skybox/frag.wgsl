struct Camera {
    viewProj: mat4x4<f32>,
    position: vec3<f32>,
    padding: f32,
    time: f32,
    padding2: vec3<f32>
}

@group(0) @binding(0) var<uniform> camera: Camera;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) starSeed: f32
}

fn hash(p: f32) -> f32 {
    var p2 = fract(p * 0.1031);
    p2 *= p2 + 33.33;
    p2 *= p2 + p2;
    return fract(p2);
}

@fragment
fn main(input: VertexOutput) -> @location(0) vec4<f32> {
    let dist = length(input.uv - vec2<f32>(0.5, 0.5)) * 2.0; 
    
    let core = 1.0 - smoothstep(0.0, 0.3, dist);
    let glow = 1.0 - smoothstep(0.0, 0.5, dist);
    let falloff = core + glow * 0.3;
    
    if(falloff <= 0.01) {
        discard;
    }

    let seed = hash(input.starSeed);
    let phase = seed * 6.28318;
    
    let twinkle = 0.7 + 0.3 * sin(camera.time * 5.0 + phase);
    let alpha = twinkle * falloff;

    return vec4<f32>(input.color, alpha);
}