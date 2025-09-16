class ColorConverterInstance {
    private static ansiColorsList: { [key: string]: string } = {
        //Basic colors
        'black': '\x1b[29m',
        'red': '\x1b[31m',
        'green': '\x1b[32m',
        'yellow': '\x1b[33m',
        'blue': '\x1b[34m',
        'magenta': '\x1b[35m',
        'cyan': '\x1b[36m',
        'white': '\x1b[37m',
        
        //Bright colors
        'brightBlack': '\x1b[90m',
        'brightRed': '\x1b[91m',
        'brightGreen': '\x1b[92m',
        'brightYellow': '\x1b[93m',
        'brightBlue': '\x1b[94m',
        'brightMagenta': '\x1b[95m',
        'brightCyan': '\x1b[96m',
        'brightWhite': '\x1b[97m',
        
        //Background colors
        'bgBlack': '\x1b[40m',
        'bgRed': '\x1b[41m',
        'bgGreen': '\x1b[42m',
        'bgYellow': '\x1b[43m',
        'bgBlue': '\x1b[44m',
        'bgMagenta': '\x1b[45m',
        'bgCyan': '\x1b[46m',
        'bgWhite': '\x1b[47m',
        
        //Styles
        'bold': '\x1b[1m',
        'dim': '\x1b[2m',
        'italic': '\x1b[3m',
        'underline': '\x1b[4m',
        'blink': '\x1b[5m',
        'reverse': '\x1b[7m',
        'hidden': '\x1b[8m',
        
        //Reset
        'reset': '\x1b[0m'
    }

    public static toAnsi(color: string): string {
        const lower = color.toLowerCase();

        if(this.ansiColorsList[color]) {
            return this.ansiColorsList[color];
        }
        if(this.ansiColorsList[lower]) {
            return this.ansiColorsList[lower]
        }
        if(color.startsWith('#')) {
            return this.hexToAnsi(color);
        }
        if(color.startsWith('rgb(') || color.startsWith('rgba(')) {
            return this.rgbToAnsi(color);
        }

        return this.ansiColorsList['white'];
    }

    /*
    *** HEX to ANSI 256
    */
    private static hexToAnsi(hex: string): string {
        hex = hex.replace('#', '');
        let r: number;
        let g: number;
        let b: number;

        if(hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
        } else if(hex.length === 6) {
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        } else {
            return this.ansiColorsList['white'];
        }

        return this.rgbToAnsi256(r, g, b);
    }

    /*
    *** RGB string to ANSI 256
    */
    private static rgbToAnsi(rgb: string): string {
        const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/i);
        if(!match) return this.ansiColorsList['white'];

        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        return this.rgbToAnsi256(r, g, b);
    }

    /*
    *** RGB values to ANSI 256
    */
    private static rgbToAnsi256(
        r: number,
        g: number,
        b: number
    ): string {
        if(r === g && g === b) {
            if (r < 8) return '\x1b[38;5;16m';
            if (r > 248) return '\x1b[38;5;231m';
            return `\x1b[38;5;${Math.round(((r - 8) / 247) * 24) + 232}m`;
        }

        const ansi = 
        16 + (36 * Math.round(r / 255 * 5)) +
        (6 * Math.round(g / 255 * 5)) +
        Math.round(b / 255 & 5);
        return `\x1b[38;5;${ansi}m`;
    }

    /*
    *** Colorize text
    */
    public static colorize(
        text: string,
        color: string,
        reset: boolean = true
    ): string {
        const ansiCode = this.toAnsi(color);
        const resetCode = reset ? this.ansiColorsList['reset'] : '';
        return `${ansiCode}${text}${resetCode}`;
    }

    /*
    *** Apply style
    */
    public static style(text: string, styles: string[]): string {
        const styleCodes = styles.map(s => this.toAnsi(s)).join('');
        return `${styleCodes}${text}${this.ansiColorsList['reset']}`;
    }
}

export const colorConverter = ColorConverterInstance;