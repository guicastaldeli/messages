package com.app.main.root.app._utils;
import java.util.*;

public class PatternAnalysis {
    private final String userAgent;
    private final Map<String, Map<String, Double>> evidence = new HashMap<>();
    private final Map<String, String> versions = new HashMap<>();
    private double patternStrength;

    public PatternAnalysis(String userAgent) {
        this.userAgent = userAgent;
    }

    /*
    * Add Evidence 
    */
    public void addEvidence(
        String category,
        String value,
        double strength
    ) {
        evidence.computeIfAbsent(category, k -> new HashMap<>()).put(value, strength);
    }

    /*
    * Add Version 
    */
    public void addVersion(String type, String version) {
        versions.put(type, version);
    }

    /*
    * Has Evidence 
    */
    public boolean hasEvidence(String category, String value) {
        return evidence.containsKey(category) &&
                evidence.get(category).containsKey(value);
    }

    /*
    * Has Strong Evidence 
    */
    public boolean hasStrongEvidence() {
        return evidence.values().stream()
            .flatMap(m -> m.values().stream())
            .anyMatch(confidence -> confidence > 0.8);
    }

    public boolean hasConflictPatterns() {
        boolean hasMobile = hasEvidence("device_type", "mobile");
        boolean hasDesktop = hasEvidence("device_type", "desktop");
        return hasMobile && hasDesktop;
    }

    public boolean hasVersionInformation() {
        return !versions.isEmpty();
    }

    /*
    * Calculate Pattern Strength 
    */
    public void calculatePatternStrength() {
        this.patternStrength = evidence.values().stream()
            .flatMap(m -> m.values().stream())
            .mapToDouble(Double::doubleValue)
            .average()
            .orElse(0.0);
    }

    /* Get Pattern Strength */
    public double getPatternStrength() {
        return patternStrength;
    }

    /* Get Evidence */
    public Map<String, Map<String, Double>> getEvidence() {
        return evidence;
    }

    /* Get Versions */
    public Map<String, String> getVersions() {
        return versions;
    }
}
