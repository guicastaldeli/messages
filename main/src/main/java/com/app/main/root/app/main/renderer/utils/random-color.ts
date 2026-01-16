/**
 * 
 * 
 * Random Color for Meshes
 * 
 * 
 */

export function getRandomColor(): [number, number, number] {
    const hue = Math.random();
    const saturation = Math.random(); 
    const value = Math.random();
    const rgb = hsvToRgb(hue, saturation, value);
    return rgb;
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    let r, g, b;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
        default: r = v; g = t; b = p;
    }

    return [r, g, b];
}