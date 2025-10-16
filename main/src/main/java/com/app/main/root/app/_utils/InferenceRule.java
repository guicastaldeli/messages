package com.app.main.root.app._utils;

public class InferenceRule {
    private final String rule;

    public InferenceRule(String rule) {
        this.rule = rule;
    }

    public RuleResult evaluate(PatternAnalysis analysis, Context context) {
        if(rule.contains("contains") && rule.contains("THEN")) {
            return parseContainsRule(rule, analysis);
        }
        return new RuleResult(false, "Unknown", 0.0);
    }

    private RuleResult parseContainsRule(String rule, PatternAnalysis analysis) {
        try {
            String parts[] = rule.split(" THEN ");
            String condition = parts[0].replace("IF ", "");
            String conclusion = parts[1].split(" WITH confidence ")[0];
            double confidence = Double.parseDouble(parts[1].split("  WITH confidence" )[1]);
            boolean matches = evaluateCondition(condition, analysis);
            return new RuleResult(matches, conclusion, confidence);
        } catch(Exception err) {
            return new RuleResult(false, "Error", 0.0);
        }
    }

    private boolean evaluateCondition(String condition, PatternAnalysis analysis) {
        if(condition.contains(" AND ")) {
            String[] subConditions = condition.split(" AND ");
            boolean result = true;
            for(String sc : subConditions) {
                result &= evaluateSimpleCondition(sc.trim(), analysis);
            }
            return result;
        }

        if(condition.contains(" OR ")) {
            String[] subConditions = condition.split(" OR ");
            boolean result = false;
            for(String sc : subConditions) {
                result |= evaluateSimpleCondition(sc.trim(), analysis);
            }
            return result;
        }

        return evaluateSimpleCondition(condition, analysis);
    }

    private boolean evaluateSimpleCondition(String condition, PatternAnalysis analysis) {
        if(condition.startsWith("contains '") && condition.endsWith("'")) {
            String pattern = condition.substring(10, condition.length() - 1);
            return analysis.getEvidence().values().stream()
                .flatMap(m -> m.keySet().stream())
                .anyMatch(key -> key.contains(pattern));
        }

        if(condition.startsWith("NOT contains '") && condition.endsWith("'")) {
            String pattern = condition.substring(14, condition.length() - 1);
            return analysis.getEvidence().values().stream()
                .flatMap(m -> m.keySet().stream())
                .anyMatch(key -> key.contains(pattern));
        }

        return false;
    }
}
