struct Uniforms {
    viewProjection: mat4x4<f32>,
    cameraPosition: vec3<f32>,
    time: f32,
    padding: f32
}

struct Material {
    useTexture: f32,
    isChat: f32,
    isFresnel: f32,
    padding0: f32,
    baseColor: vec4<f32>,
    specularPower: f32,
    specularIntensity: f32,
    padding1: vec2<f32>
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

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
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

fn applyFresnel(
    baseColor: vec3<f32>,
    normal: vec3<f32>,
    viewDir: vec3<f32>,
    worldPos: vec3<f32>,
    planetSize: f32,
    uTime: f32
) -> vec3<f32> {
    var fresnel = 1.0 - max(dot(normal, viewDir), 0.0);
    fresnel = pow(fresnel, 1.5);

    let distFromCenter = length(worldPos);
    let normalizedDist = distFromCenter / planetSize;

    let glowFalloff = 0.3;
    let glow = exp(-(normalizedDist - 1.0) / glowFalloff);

    var totalEffect = fresnel * (1.0 + glow * 2.0);
    totalEffect = clamp(totalEffect, 0.0, 1.0);

    let pulse = sin(uTime * 0.5) * 0.05 + 0.95;
    let atmosphereCore = vec3<f32>(0.0, 0.1, 0.9);
    let atmosphereMid = vec3<f32>(0.0, 0.4, 1.2); 
    let atmosphereEdge = vec3<f32>(0.2, 0.6, 1.4);

    var atmosphereColor: vec3<f32>;
    if(totalEffect < 0.5) {
        atmosphereColor = mix(
            atmosphereCore,
            atmosphereMid,
            totalEffect * 2.0
        );
    } else {
        atmosphereColor = mix(
            atmosphereMid,
            atmosphereEdge,
            (totalEffect - 0.5) * 2.0
        );
    }

    return mix(baseColor, atmosphereColor, totalEffect * 0.7 * pulse);
}

@fragment
fn main(input: VertexOutput) -> @location(0) vec4<f32> {
    let normal = normalize(input.worldNormal);
    let viewDir = normalize(-input.worldPos);

    var baseColor: vec4<f32>;
    if(material.useTexture > 0.5) {
        let texColor = textureSample(
            baseColorTexture,
            textureSampler,
            input.texCoord
        );
        
        if(material.isChat > 0.5 || material.isFresnel > 0.5) {
            baseColor = vec4<f32>(texColor.rgb * material.baseColor.rgb, texColor.a);
        } else {
            baseColor = texColor;
        }
        if(material.isFresnel > 0.5) {
            baseColor.a = baseColor.a * 0.2;
        }
    } else {
        baseColor = vec4<f32>(input.color, 1.0);
    }

    var finalColor = baseColor.rgb;
    if(material.isFresnel > 0.5) {
        let planetSize = 2.0;
        let uTime = uniforms.time;

        finalColor = applyFresnel(
            finalColor,
            normal,
            viewDir,
            input.worldPos,
            planetSize,
            uTime
        );
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

    finalColor = finalColor * (ambient + directional);
    return vec4<f32>(finalColor, baseColor.a);
}