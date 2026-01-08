package com.app.main.root.app.utils;

public class Context {
    private int userAgentLength;
    private boolean hasComplexStructure;
    private boolean hasVersionNumbers;
    private boolean unusualCombination;
    private boolean likelyBot;
    private boolean mobile;
    private int patternCorrelations;

    /**
     * Multiple Correlations
     */
    public boolean hasMultipleCorrelations() {
        return patternCorrelations >= 2;
    }

    /**
     * User Agent Length
     */
    public void setUserAgentLength(int length) {
        this.userAgentLength = length;
    }
    public int getUserAgentLength() {
        return userAgentLength;
    }

    /**
     * Complex Structure 
     */
    public void setComplexStructure(boolean hasComplexStructure) {
        this.hasComplexStructure = hasComplexStructure;
    }
    public boolean isComplexStructure() {
        return hasComplexStructure;
    }

    /**
     * Version Numbers
     */
    public void setVersionNumbers(boolean hasVersionNumbers) {
        this.hasVersionNumbers = hasVersionNumbers;
    }
    public boolean isVersionNumbers() {
        return hasVersionNumbers;
    }

    /**
     * Unusual Combination
     */
    public void setUnusualCombination(boolean unusualCombination) {
        this.unusualCombination = unusualCombination;
    }
    public boolean isUnusualCombination() {
        return unusualCombination;
    }

    /**
     * Likely Bot
     */
    public void setLikelyBot(boolean bot) {
        this.likelyBot = bot;
    }
    public boolean isLikelyBot() {
        return likelyBot;
    }

    /**
     * Mobile Optimized
     */
    public void setMobile(boolean m) {
        this.mobile = m;
    }
    public boolean isMobile() {
        return mobile;
    }

    /**
     * Pattern Correlations
     */
    public void setPatternCorrelations(int pattern) {
        this.patternCorrelations = pattern;
    }
    public int getPatternCorrelations() {
        return patternCorrelations;
    }
}
