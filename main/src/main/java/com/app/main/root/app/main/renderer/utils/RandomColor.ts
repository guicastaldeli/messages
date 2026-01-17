/**
 * 
 * 
 * Random Color for Meshes
 * 
 * 
 */

import { UserColorGenerator } from "@/app/utils/UserColorGenerator";

export function getRandomColor(): [number, number, number] {
    const randomIndex = Math.floor(Math.random() * UserColorGenerator.COLOR_PALETTE.length);
    const colorObj = UserColorGenerator.COLOR_PALETTE[randomIndex];
    console.log('Selected color:', colorObj.name, 'at index:', randomIndex); // Debug
    return hexToRgbNorm(colorObj.value);
}

function hexToRgbNorm(hex: string): [number, number, number] {
    const regex = /^#/;
    hex = hex.replace(regex, '');

    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    return [r, g, b];
}