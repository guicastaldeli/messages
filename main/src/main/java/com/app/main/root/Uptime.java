package com.app.main.root;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class Uptime {
    private static final long START_TIME = System.currentTimeMillis();

    private static String set() {
        long uptimeMillis = System.currentTimeMillis() - START_TIME;
        long seconds = uptimeMillis / 1000 % 60;
        long minutes = uptimeMillis / (1000 * 60) % 60;
        long hours = uptimeMillis / (1000 * 60 * 60) % 24;
        long days = uptimeMillis / (1000 * 60 * 60 * 24);
        
        if (days > 0) {
            return String.format("%dd %02dh %02dm %02ds", days, hours, minutes, seconds);
        } else if(hours > 0) {
            return String.format("%02dh %02dm %02ds", hours, minutes, seconds);
        } else if(minutes > 0) {
            return String.format("%02dm %02ds", minutes, seconds);
        } else {
            return String.format("%02ds", seconds);
        }
    }

    @GetMapping("/api/uptime")
    public String get() {
        return set();
    }
}
