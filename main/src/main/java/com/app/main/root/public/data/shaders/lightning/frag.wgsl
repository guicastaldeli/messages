struct Material {
    useTexture: f32,
    isChat: f32,
    baseColor: vec3<f32>,
    specularPower: f32,
    specularIntensity: f32,
    padding: f32
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

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) texCoord: vec2<f32>,
    @location(1) worldPos: vec3<f32>,
    @location(2) color: vec3<f32>,
    @location(3) normal: vec3<f32>,
    @location(4) worldNormal: vec3<f32>
}

@group(0) @binding(2) var<uniform> material: Material;
@group(0) @binding(3) var baseColorTexture: texture_2d<f32>;
@group(0) @binding(4) var textureSampler: sampler;
@group(1) @binding(0) var<uniform> lightning: Lightning;

fn calculateDirectionalLight(
    light: DirectionalLight, 
    normal: vec3<f32>, 
    viewDir: vec3<f32>,
    specularPower: f32,
    specularIntensity: f32
) -> vec3<f32> {
    let lightDir = normalize(-light.direction);
    let diff = max(dot(normal, lightDir), 0.0);
    let diffuse = diff * light.color * light.intensity;
    
    let reflectDir = reflect(-lightDir, normal);
    let spec = pow(max(dot(viewDir, reflectDir), 0.0), specularPower) * specularIntensity;
    let specular = spec * light.color * light.intensity;
    
    return diffuse + specular;
}

@fragment
fn main(input: VertexOutput) -> @location(0) vec4<f32> {
    let normal = normalize(input.worldNormal);
    let viewDir = normalize(-input.worldPos);

    var baseColor: vec3<f32>;
    if(material.useTexture > 0.5) {
        let texColor = textureSample(
            baseColorTexture,
            textureSampler,
            input.texCoord
        ).rgb;
        if(material.isChat > 0.5) {
            baseColor = texColor * material.baseColor;
        } else {
            baseColor = texColor;
        }
    } else {
        baseColor = input.color;
    }

    let ambient = lightning.ambient.color * lightning.ambient.intensity;

    var directional = vec3<f32>(0.0);
    if(lightning.lightCount > 0) {
        directional = calculateDirectionalLight(
            lightning.directional,
            normal,
            viewDir,
            material.specularPower,
            material.specularIntensity
        );
    }

    let finalColor = baseColor * (ambient + directional);
    return vec4<f32>(finalColor, 1.0);
}