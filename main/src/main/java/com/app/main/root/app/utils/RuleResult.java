package com.app.main.root.app.utils;

public class RuleResult {
    private final boolean matches;
    private final String conclusion;
    private final double confidence;

    public RuleResult(
        boolean matches,
        String conclusion,
        double confidence
    ) {
        this.matches = matches;
        this.conclusion = conclusion;
        this.confidence = confidence;
    }

    public boolean matches() {
        return matches;
    }

    /**
     * Get Conclusion
     */
    public String getConclusion() {
        return conclusion;
    }

    /**
     * Get Confidence
     */
    public double getConfidence() {
        return confidence;
    }
}
