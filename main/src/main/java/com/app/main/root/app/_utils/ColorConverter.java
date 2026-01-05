package com.app.main.root.app._utils;
import org.springframework.stereotype.Component;
import java.util.regex.Pattern;
import java.util.regex.Matcher;
import java.util.HashMap;
import java.util.Map;

@Component
public class ColorConverter {
    public static final Map<String, String> ansiColorsList = new HashMap<>();
    static {
        //Basic colors
        ansiColorsList.put("black", "\u001B[30m");
        ansiColorsList.put("red", "\u001B[31m");
        ansiColorsList.put("green", "\u001B[32m");
        ansiColorsList.put("yellow", "\u001B[33m");
        ansiColorsList.put("blue", "\u001B[34m");
        ansiColorsList.put("magenta", "\u001B[35m");
        ansiColorsList.put("cyan", "\u001B[36m");
        ansiColorsList.put("white", "\u001B[37m");
        ansiColorsList.put("orange", "\u001B[38;5;208m");
        
        //Bright colors
        ansiColorsList.put("brightBlack", "\u001B[90m");
        ansiColorsList.put("brightRed", "\u001B[91m");
        ansiColorsList.put("brightGreen", "\u001B[92m");
        ansiColorsList.put("brightYellow", "\u001B[93m");
        ansiColorsList.put("brightBlue", "\u001B[94m");
        ansiColorsList.put("brightMagenta", "\u001B[95m");
        ansiColorsList.put("brightCyan", "\u001B[96m");
        ansiColorsList.put("brightWhite", "\u001B[97m");
        
        //Background colors
        ansiColorsList.put("bgBlack", "\u001B[40m");
        ansiColorsList.put("bgRed", "\u001B[41m");
        ansiColorsList.put("bgGreen", "\u001B[42m");
        ansiColorsList.put("bgYellow", "\u001B[43m");
        ansiColorsList.put("bgBlue", "\u001B[44m");
        ansiColorsList.put("bgMagenta", "\u001B[45m");
        ansiColorsList.put("bgCyan", "\u001B[46m");
        ansiColorsList.put("bgWhite", "\u001B[47m");
        
        //Styles
        ansiColorsList.put("bold", "\u001B[1m");
        ansiColorsList.put("dim", "\u001B[2m");
        ansiColorsList.put("italic", "\u001B[3m");
        ansiColorsList.put("underline", "\u001B[4m");
        ansiColorsList.put("blink", "\u001B[5m");
        ansiColorsList.put("reverse", "\u001B[7m");
        ansiColorsList.put("hidden", "\u001B[8m");
    
        //Reset
        ansiColorsList.put("reset", "\u001B[0m");
    }

    public String toAnsi(String color) {
        if(color == null || color.isEmpty()) return ansiColorsList.get("white");
        String lower = color.toLowerCase();

        if(ansiColorsList.containsKey(color)) return ansiColorsList.get(color);
        if(ansiColorsList.containsKey(lower)) return ansiColorsList.get(lower);
        if(color.startsWith("#")) return hexToAnsi(color);
        if(color.startsWith("rgb(") || color.startsWith("rgba(")) return rgbToAnsi(color);
        return ansiColorsList.get("white");
    }

    /*
    *** HEX to ANSI 256
    */
    private String hexToAnsi(String hex) {
        hex = hex.replace("#", "");
        int r, g, b;
        
        if(hex.length() == 3) {
            r = Integer.parseInt(hex.substring(0, 1) + hex.substring(0, 1), 16);
            g = Integer.parseInt(hex.substring(1, 2) + hex.substring(1, 2), 16);
            b = Integer.parseInt(hex.substring(2, 3) + hex.substring(2, 3), 16);
        } else if(hex.length() == 6) {
            r = Integer.parseInt(hex.substring(0, 2), 16);
            g = Integer.parseInt(hex.substring(2, 4), 16);
            b = Integer.parseInt(hex.substring(4, 6), 16);
        } else {
            return ansiColorsList.get("white");
        }
        
        return rgbToAnsi256(r, g, b);
    }

    /*
    *** RGB string to ANSI 256
    */
    private String rgbToAnsi(String rgb) {
        Pattern pattern = Pattern.compile(
            "rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*[\\d.]+)?\\)",
            Pattern.CASE_INSENSITIVE 
        );

        Matcher matcher = pattern.matcher(rgb);
        if(!matcher.find()) return ansiColorsList.get("white");

        int r = Integer.parseInt(matcher.group(1));
        int g = Integer.parseInt(matcher.group(2));
        int b = Integer.parseInt(matcher.group(3));
        return rgbToAnsi256(r, g, b);
    }

    /*
    *** RGB values to ANSI 256
    */
    private String rgbToAnsi256(
        int r,
        int b,
        int g
    ) {
        if(r == g && g == b) {
            if(r < 8) return "\u001B[38;5;16m";
            if(r > 248) return "\u001B[38;5;231m";
            int gray = Math.round(((r - 8) / 247.0f) * 24) + 232;

            String format = "\u001B[38;5;%dm";
            return String.format(format, gray);
        }
        
        int ansi = 
        16 + (36 * Math.round(r / 255.0f * 5)) + 
        (6 * Math.round(g / 255.0f * 5)) + 
        Math.round(b / 255.0f * 5);

        String format = "\u001B[38;5;%dm";
        return String.format(format, ansi);
    }

    /*
    *** Colorize text
    */
    public String colorize(String text, String color) {
        return colorizeText(text, color, true);
    }

    public String colorizeText(String text, String color, boolean reset) {
        String ansiCode = toAnsi(color);
        String resetCode = reset ? ansiColorsList.get("reset") : "";
        return ansiCode + text + resetCode;
    }

    /*
    *** Apply style
    */
    public String style(String text, String... styles) {
        StringBuilder styleCodes = new StringBuilder();
        for(String style : styles) styleCodes.append(toAnsi(style));
        return styleCodes.toString() + text + ansiColorsList.get("reset");
    }
} 