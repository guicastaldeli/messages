package com.app.main.root.app.utils;

public class ContextualReasoner {
    public Context buildContext(PatternAnalysis analysis, String userAgent) {
        Context context = new Context();

        context.setUserAgentLength(userAgent.length());
        context.setComplexStructure(userAgent.split(" ").length > 5);
        context.setVersionNumbers(analysis.hasVersionInformation());
        context.setUnusualCombination(detectUnusualCombinations(analysis));
        context.setLikelyBot(detectBotPatterns(userAgent));
        context.setMobile(detectMobile(userAgent));
        context.setPatternCorrelations(calculateCorrelations(analysis));

        return context;
    }

    /*
    * Unusual Combinations 
    */
    private boolean detectUnusualCombinations(PatternAnalysis analysis) {
        return (analysis.hasEvidence("browser", "Safari") && analysis.hasEvidence("os", "Android")) ||
                (analysis.hasEvidence("browser", "Firefox") && analysis.hasEvidence("os", "iOS")) ||
                (analysis.hasEvidence("device_type", "mobile") && analysis.hasEvidence("os", "Windows"));
    }

    /*
    * Detect Bot Patterns 
    */
    private boolean detectBotPatterns(String userAgent) {
        String ua = userAgent.toLowerCase();
        return ua.contains("bot") || 
                ua.contains("crawler") || 
                ua.contains("spider") ||
                ua.length() < 20 || 
                ua.contains("python") || 
                ua.contains("java") ||
                ua.contains("curl") || 
                ua.contains("wget");
    }

    /*
    * Detect Mobile 
    */
    private boolean detectMobile(String userAgent) {
        String ua = userAgent.toLowerCase();
        return ua.contains("mobile") || 
                ua.contains("mobi") || 
                ua.contains("phone") ||
                ua.contains("android") ||
                ua.contains("iphone") || 
                ua.contains("ipad");
    }

    private int calculateCorrelations(PatternAnalysis analysis) {
        int correlations = 0;
        if(analysis.hasEvidence("browser", "Safari") && analysis.hasEvidence("os", "iOS")) correlations++;
        if(analysis.hasEvidence("browser", "Chrome") && analysis.hasEvidence("os", "Android")) correlations++;
        if(
            analysis.hasEvidence("device_type", "mobile") && 
            (analysis.hasEvidence("os", "Android") || 
            analysis.hasEvidence("os", "iOS"))
        ) {
            correlations++;
        }
        return correlations;
    }
}
