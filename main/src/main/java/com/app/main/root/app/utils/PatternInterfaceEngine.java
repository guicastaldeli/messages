package com.app.main.root.app.utils;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import com.app.main.root.app._data.UserAgentParserRegistryData;

public class PatternInterfaceEngine {
    private List<Map<String, Object>> devices = new ArrayList<>();
    private List<Map<String, Object>> browsers = new ArrayList<>();
    private List<Map<String, Object>> os = new ArrayList<>();

    public void updateFromApi(UserAgentParserRegistryData registry) {
        this.devices = registry.getDevices();
        this.browsers = registry.getBrowsers();
        this.os = registry.getOs();
    }

    public PatternAnalysis analyzeWithPatterns(String userAgent) {
        PatternAnalysis analysis = new PatternAnalysis(userAgent);
        String ua = userAgent.toLowerCase();

        analyzeWithDevices(ua, analysis);
        analyzeWithBrowsers(ua, analysis);
        analyzeWithOs(ua, analysis);
        analyzeWithBasicPatterns(ua, analysis);

        analysis.calculatePatternStrength();
        return analysis;
    }

    /*
    * Analyze With Devices... 
    */
    private void analyzeWithDevices(String ua, PatternAnalysis analysis) {
        for(Map<String, Object> d : devices) {
            String brand = (String) d.get("brand");
            String type = (String) d.get("type");
            List<String> patterns = (List<String>) d.get("patterns");

            for(String p : patterns) {
                if(ua.contains(p)) {
                    analysis.addEvidence("device_brand", brand, 0.8);
                    analysis.addEvidence("device_type", type, 0.7);
                }
            }
        }
    }

    /*
    * Analyze With Browsers
    */
    private void analyzeWithBrowsers(String ua, PatternAnalysis analysis) {
        for(Map<String, Object> b : browsers) {
            String name = (String) b.get("name");
            List<String> patterns = (List<String>) b.get("patterns");
            List<String> versionPatterns = (List<String>) b.get("version_patterns");

            for(String p : patterns) {
                if(ua.contains(p)) {
                    analysis.addEvidence("browser", name, 0.8);
                    if(versionPatterns != null) {
                        for(String vPattern : versionPatterns) {
                            extractVersion(ua, name, vPattern, analysis);
                        }
                    }
                }
            }
        }
    }

    /*
    * Analyze With OS 
    */
    private void analyzeWithOs(String ua, PatternAnalysis analysis) {
        for(Map<String, Object> o : os) {
            String name = (String) o.get("name");
            List<String> patterns = (List<String>) o.get("patterns");
            Map<String, Object> versions = (Map<String, Object>) o.get("versions");

            for(String p : patterns) {
                if(ua.contains(p)) {
                    analysis.addEvidence("os", name, 0.8);

                    if(versions != null) {
                        for(String v : versions.keySet()) {
                            Map<String, Object> vInfo = (Map<String, Object>) versions.get(v);
                            String vPattern = (String) vInfo.get("pattern");
                            if(ua.contains(vPattern)) analysis.addEvidence("os_version", v, 0.9);
                        }
                    }
                }
            }
        }
    }

    private void analyzeWithBasicPatterns(String ua, PatternAnalysis analysis) {
        if(ua.contains("chrome") && !ua.contains("edg")) analysis.addEvidence("browser", "Chrome", 0.7);
        if(ua.contains("chrome") && ua.contains("edg")) analysis.addEvidence("browser", "Edge", 0.9);
        if(ua.contains("firefox")) analysis.addEvidence("browser", "Firefox", 0.7);
        if(ua.contains("safari") && !ua.contains("chrome")) analysis.addEvidence("browser", "Safari", 0.6);
        if(ua.contains("windows")) analysis.addEvidence("os", "Windows", 0.7);
        if(ua.contains("android")) analysis.addEvidence("os", "Android", 0.8);
        if(ua.contains("iphone") || ua.contains("ipad")) analysis.addEvidence("os", "iOS", 0.8);
        if(ua.contains("mobile")) analysis.addEvidence("device_type", "mobile", 0.6);
        if(ua.contains("tablet")) analysis.addEvidence("device_type", "tablet", 0.7);
    }

    /*
    * Extract Version 
    */
    public void extractVersion(
        String ua,
        String type,
        String pattern,
        PatternAnalysis analysis
    ) {
        try {
            Pattern regex = Pattern.compile(pattern);
            Matcher matcher = regex.matcher(ua);
            if(matcher.find()) analysis.addVersion(type, matcher.group(1));
        } catch(Exception err) {
            System.err.println("EXTRACT VERSION error: " + err);
        }
    }
}
