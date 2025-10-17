package com.app.main.root.app._utils;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class InferenceRule {
    private final String rule;

    public InferenceRule(String rule) {
        this.rule = rule;
    }

    public RuleResult evaluate(PatternAnalysis analysis, Context context) {
        if(rule.contains("contains") && rule.contains("THEN")) {
            return parseContainsRule(rule, analysis);
        }
        return new RuleResult(false, "Unknown **Rule", 0.0);
    }

    private RuleResult parseContainsRule(String rule, PatternAnalysis analysis) {
        try {
            String parts[] = rule.split(" THEN ");
            String condition = parts[0].replace("IF ", "");
            String conclusion = parts[1].split(" WITH confidence ")[0];
            double confidence = Double.parseDouble(parts[1].split(" WITH confidence ")[1]);
            boolean matches = evaluateCondition(condition, analysis);
            return new RuleResult(matches, conclusion, confidence);
        } catch(Exception err) {
            return new RuleResult(false, "Error **Rule", 0.0);
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
        try {
            Pattern extractionPattern = Pattern.compile(
                "(?:IF\\s+)?(?:NOT\\s+)?(contains|matches|startsWith|endsWith)\\s+'([^']*)'", 
                Pattern.CASE_INSENSITIVE
            );

            Matcher matcher = extractionPattern.matcher(condition);
            if(!matcher.find()) return false;

            String operator = matcher.group(1).toLowerCase();
            String pattern = matcher.group(2);
            boolean isNegated = condition.toLowerCase().contains("not");
            if(pattern.isEmpty()) return false;

            boolean result = evaluateWithOperator(pattern, operator, analysis);
            return isNegated ? !result : result;
        } catch(Exception err) {
            System.err.println("Condition evaluatione err: " + err);
            return false;
        }
    }

    private boolean evaluateWithOperator(
        String patter,
        String operator,
        PatternAnalysis analysis
    ) {
        String lowercasePattern = patter.toLowerCase();
        return analysis.getEvidence().values().stream()
            .flatMap(evidenceMap -> evidenceMap.keySet().stream())
            .anyMatch(key -> {
                String lowercaseKey = key.toLowerCase();

                switch(operator) {
                    case "contains":
                    return containsMatch(lowercaseKey, lowercasePattern);
                    case "matches":
                        return Pattern.compile(lowercasePattern).matcher(lowercaseKey).matches();
                    case "startswith":
                        return lowercaseKey.startsWith(lowercasePattern);
                    case "endswith":
                        return lowercaseKey.endsWith(lowercasePattern);
                    default:
                        return false;
                    }
            });
    }

    private boolean containsMatch(String text, String pattern) {
        if(text.contains(pattern)) return true;

        try {
            Pattern wordPattern = Pattern.compile("\\b" + Pattern.quote(pattern) + "\\b");
            return wordPattern.matcher(text).find();
        } catch(Exception err) {
            System.err.println(err);
            return false;
        }
    }
}
