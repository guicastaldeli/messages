package com.app.main.root.app._data;
import com.app.main.root.app.__controllers.UserAgentParserPrediction;
import com.app.main.root.app._utils.Context;
import com.app.main.root.app._utils.InferenceRule;
import com.app.main.root.app._utils.PatternAnalysis;
import com.app.main.root.app._utils.RuleResult;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

public class UserAgentKnowledgeBase {
    private final Map<String, List<InferenceRule>> rules = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> devices = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> browsers = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> osList = new ConcurrentHashMap<>();
    private final AtomicInteger ruleCount = new AtomicInteger(0);

    public void buildFromApi(UserAgentParserRegistryData registry) {
        rules.clear();
        devices.clear();
        browsers.clear();
        osList.clear();
        ruleCount.set(0);

        storeDevices(registry.getDevices());
        storeBrowsers(registry.getBrowsers());
        storeOs(registry.getOs());
        buildRulesFromApi(registry);
        
        System.out.println("Knowledge base build from API");
    }

    private void buildFallbackKnowledge() {
        addRule("browser", "IF contains 'chrome' AND NOT contains 'edg' THEN 'Chrome' WITH confidence 0.9");
        addRule("browser", "IF contains 'firefox' THEN 'Firefox' WITH confidence 0.9");
        addRule("browser", "IF contains 'safari' AND NOT contains 'chrome' THEN 'Safari' WITH confidence 0.8");
        addRule("os", "IF contains 'windows' THEN 'Windows' WITH confidence 0.9");
        addRule("os", "IF contains 'android' THEN 'Android' WITH confidence 0.95");
        addRule("os", "IF contains 'iphone' OR contains 'ipad' THEN 'iOS' WITH confidence 0.9");
        addRule("device", "IF contains 'mobile' THEN device_type='mobile' WITH confidence 0.7");
        addRule("device", "IF contains 'tablet' THEN device_type='tablet' WITH confidence 0.8");
        addRule("device", "IF contains 'windows nt' THEN device_brand='Desktop' WITH confidence 0.8");
        addRule("device", "IF contains 'macintosh' THEN device_brand='Apple' WITH confidence 0.9");
        addRule("device", "IF device_type='desktop' AND device_brand='Unknown' THEN device_brand='Desktop' WITH confidence 0.6");
        System.out.println("Using fallback knowledge base...");
    }

    /*
    * Store Devices 
    */
    private void storeDevices(List<Map<String, Object>> list) {
        if(list != null) {
            for(Map<String, Object> d : list) {
                String brand = (String) d.get("brand");
                if(brand != null) {
                    devices.put(brand.toLowerCase(), d);
                }
            }
        }
    }

    /*
    * Store Browsers 
    */
    private void storeBrowsers(List<Map<String, Object>> list) {
        if(list != null) {
            for(Map<String, Object> b : list) {
                String name = (String) b.get("name");
                if(name != null) {
                    browsers.put(name.toLowerCase(), b);
                }
            }
        }
    }

    /*
    * Store OS 
    */
    public void storeOs(List<Map<String, Object>> list) {
        if(list != null) {
            for(Map<String, Object> os : list) {
                String name = (String) os.get("name");
                if(name != null) {
                    osList.put(name.toLowerCase(), os);
                }
            }
        }
    }

    private void buildRulesFromApi(UserAgentParserRegistryData registry) {
        /* Device */
        if(registry.getDevices() != null) {
            for(Map<String, Object> d : registry.getDevices()) {
                List<String> rules = (List<String>) d.get("ai_rules");
                if(rules != null) {
                    for(String rule : rules) {
                        addRule("device", rule);
                    }
                }
            }
        }

        /* Browser */
        if(registry.getBrowsers() != null) {
            for(Map<String, Object> b : registry.getBrowsers()) {
                List<String> rules = (List<String>) b.get("ai_rules");
                if(rules != null) {
                    for(String rule : rules) {
                        addRule("browser", rule);
                    }
                }
            }
        }

        /* OS */
        if(registry.getOs() != null) {
            for(Map<String, Object> os : registry.getOs()) {
                List<String> rules = (List<String>) os.get("ai_rules");
                if(rules != null) {
                    for(String rule : rules) {
                        addRule("os", rule);
                    }
                }
            }
        }

        /* AI Rules */
        if(registry.getRules() != null) {
            for(Map<String, Object> ruleCategory : registry.getRules()) {
                String category = (String) ruleCategory.get("category");
                List<String> ruleStrings = (List<String>) ruleCategory.get("rules");
                if(ruleStrings != null) {
                    for(String rule : ruleStrings) {
                        addRule(category, rule);
                    }
                } 
            }
        }
    }

    /*
    * Infer 
    */
    public UserAgentParserPrediction inferWithRules(PatternAnalysis analysis, Context context) {
        UserAgentParserPrediction prediction = new UserAgentParserPrediction();

        prediction.setBrowser(applyRules("browser", analysis, context));
        prediction.setOs(applyRules("os", analysis, context));
        String deviceResult = applyRules("device", analysis, context);
        extractDeviceTypeAndBrand(deviceResult, prediction);
        applyValidationRules(prediction, analysis, context);

        prediction.setConfidence(calculateRuleConfidence(analysis));
        prediction.setReasoning("API Rules Engine");
        return prediction;
    } 

    /*
    * Extract Type and Brand 
    */
    private void extractDeviceTypeAndBrand(
        String result,
        UserAgentParserPrediction prediction
    ) {
        if(result == null || result.startsWith("Unknown")) {
            String msg = "Unknown **Extract Fail";
            prediction.setDeviceType(msg);
            prediction.setDeviceBrand(msg);
            return;
        }

        prediction.setDeviceType("Unknown Type");
        prediction.setDeviceBrand("Unknown Brand");

        /* Brand */
        if(result.contains("device_brand='")) {
            String[] parts = result.split("device_brand='");
            if(parts.length > 1) {
                String brand = parts[1].split("'")[0];
                prediction.setDeviceBrand(brand);
            }
        }

        /* Type */
        if(result.contains("device_type='")) {
            String[] parts = result.split("device_type='");
            if(parts.length > 1) {
                String type = parts[1].split("'")[0];
                prediction.setDeviceType(type);
            }
        }

        if(result.contains(" AND ")) {
            String[] conclusions = result.split(" AND ");
            for(String conclusion : conclusions) {
                processConclusion(conclusion.trim(), prediction);
            }
        } else {
            processConclusion(result, prediction);
        }
    }

    /*
    * Process Conclusion
    */
    private void processConclusion(String conclusion, UserAgentParserPrediction prediction) {
        if(conclusion.startsWith("device_brand='") && conclusion.endsWith("'")) {
            String brand = conclusion.substring(14, conclusion.length() - 1);
            prediction.setDeviceBrand(brand);
        } 
        else if(conclusion.startsWith("device_type='") && conclusion.endsWith("'")) {
            String type = conclusion.substring(13, conclusion.length() - 1);
            prediction.setDeviceType(type);
        }
        else if(conclusion.startsWith("browser='") && conclusion.endsWith("'")) {
            String browser = conclusion.substring(9, conclusion.length() - 1);
            prediction.setBrowser(browser);
        }
        else if(conclusion.startsWith("os='") && conclusion.endsWith("'")) {
            String os = conclusion.substring(4, conclusion.length() - 1);
            prediction.setOs(os);
        }
        else if(!conclusion.contains("'") && !conclusion.contains("=")) {
            prediction.setDeviceType(conclusion);
        }
    }

    /*
    * Apply Rules 
    */
    private String applyRules(
        String category,
        PatternAnalysis analysis,
        Context context
    ) {
        List<InferenceRule> categoryRules = rules.get(category);
        Map<String, Double> candidates = new HashMap<>();
        if(categoryRules == null) return "Unknown **Rules Null";

        for(InferenceRule rule : categoryRules) {
            RuleResult result = rule.evaluate(analysis, context);
            if(result.matches()) {
                candidates.merge(
                    result.getConclusion(),
                    result.getConfidence(),
                    (old, newConf) -> Math.max(old, newConf)
                );
            }
        }

        return candidates.entrySet().stream()
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey)
            .orElse("Unknown **Value Null");
    }

    /*
    * Validation Rules 
    */
    private void applyValidationRules(
        UserAgentParserPrediction prediction,
        PatternAnalysis analysis,
        Context context
    ) {
        List<InferenceRule> validationRules = rules.get("impossible_combinations");
        if(validationRules != null) {
            for(InferenceRule rule : validationRules) {
                RuleResult result = rule.evaluate(analysis, context);
                if(result.matches() && result.getConclusion().contains("IMPOSSIBLE")) {
                    prediction.adjustConfidence(-0.3);
                    prediction.setReasoning(prediction.getReasoning() + " | " + result.getConclusion());
                }
            }
        }
    }

    /*
    * Calculate Rule Confidence 
    */
    private double calculateRuleConfidence(PatternAnalysis analysis) {
        double baseConfidence = analysis.getPatternStrength();
        if(analysis.hasVersionInformation()) baseConfidence += 0.2;
        if(analysis.hasStrongEvidence()) baseConfidence += 0.15;
        return Math.min(0.95, Math.max(0.1, baseConfidence));
    }

    /*
    * Add Rule 
    */
    private void addRule(String category, String rule) {
        rules.computeIfAbsent(category, k -> new ArrayList<>())
            .add(new InferenceRule(rule));
        ruleCount.incrementAndGet();
    }

    /* Get Rule Count */
    public int getRuleCount() {
        return ruleCount.get();
    }

    /* Get Device Count */
    public int getDeviceCount() {
        return devices.size();
    }

    /* Get Browser Count */
    public int getBrowserCount() {
        return browsers.size();
    }

    /* Get OS Count */
    public int getOsCount() {
        return osList.size();
    }
}

 