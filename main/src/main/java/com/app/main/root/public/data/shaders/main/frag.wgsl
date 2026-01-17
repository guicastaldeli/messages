struct Material {
    useTexture: f32,
    padding: vec3<f32>
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) texCoord: vec2<f32>,
    @location(1) worldPos: vec3<f32>,
    @location(2) color: vec3<f32>,
    @location(3) normal: vec3<f32>
}

@group(0) @binding(2) var<uniform> material: Material;
@group(0) @binding(3) var baseColorTexture: texture_2d<f32>;
@group(0) @binding(4) var textureSampler: sampler;

@fragment
fn main(input: VertexOutput) -> @location(0) vec4<f32> {
    if(material.useTexture > 0.5) {
        var texColor = textureSample(baseColorTexture, textureSampler, input.texCoord);
        return vec4<f32>(texColor.rgb, texColor.a);
    } else {
        return vec4<f32>(input.color, 1.0);
    }
}
