package com.app.main.root.app.__controllers;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.app.main.root.app._data.UserAgentKnowledgeBase;
import com.app.main.root.app._data.UserAgentParserRegistryData;
import com.app.main.root.app._utils.ContextualReasoner;
import com.app.main.root.app._utils.PatternInterfaceEngine;
import com.app.main.root.app._utils.UserAgentParserApiClient;
import com.fasterxml.jackson.core.type.TypeReference;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;
import java.util.regex.Matcher;
import java.net.URI;
import java.util.*;

@Component
public class UserAgentParserController {
    private final UserAgentKnowledgeBase knowledgeBase;
    private final PatternInterfaceEngine interfaceEngine;
    private final ContextualReasoner contextualReasoner;
    private final UserAgentParserApiClient apiClient;

    public UserAgentParserController() {
        this.knowledgeBase = new UserAgentKnowledgeBase();
        this.interfaceEngine = new PatternInterfaceEngine();
        this.contextualReasoner = new ContextualReasoner();
        this.apiClient = new UserAgentParserApiClient();
        init();
    }

    private void init() {
        try {
            System.out.println("Initializing UAP...");
            UserAgentParserRegistryData registryData = apiClient.fetchAllRegistryData();
            knowledgeBase.buildFromApi(registryData);
            interfaceEngine.updateFromApi(registryData);

            System.out.println(
                "UAP Initialized with API: " +
                knowledgeBase.getRuleCount() + " rules, " +
                knowledgeBase.getDeviceCount() + " devices, " +
                knowledgeBase.getBrowserCount() + " browsers, " +
                knowledgeBase.getOSCount() + "OS"
            );
        } catch(Exception err) {
            System.err.println("Failed to init UAP..." + err.getMessage());
        }
    }

    public UserAgentParserPrediction analyze(String userAgent) {
        if(userAgent == null || userAgent.isEmpty()) return UserAgentParserPrediction.unknown();

        try {
            PatternAnalysis patternAnalysis = interfaceEngine.analizeWithPatterns(userAgent);
            Context context = contextualReasoner.buildContext(patternAnalysis, userAgent);
            UserAgentParserPrediction prediction = knowledgeBase.inferWithRules(patternAnalysis, context);
            prediction = calibrateConfidence(prediction, patternAnalysis, context);
            return prediction; 
        } catch(Exception err) {
            System.err.println("Analysis failed: " + err.getMessage());
        }
    }

    public void trainWithVerifiedData(
        String userAgent,
        String browser,
        String os,
        String device
    ) {
        try {
            apiClient.sendTrainingExample(userAgent, browser, os, device);
            System.out.println("Training data...:" + browser + "/" + os + "/" + device);
        } catch(Exception err) {
            System.err.println("Failed to send training data: " + err.getMessage());
        }
    }

    public void refreshFromApi() {
        System.out.println("Refreshing from API...");
        init();
    }

    public Map<String, Object> getSystemStstus() {
        try {
            return apiClient.getStatus();
        } catch(Exception err) {
            Map<String, Object> status = new HashMap<>();
            status.put("status", "fallback");
            status.put("rules", knowledgeBase.getRuleCount());
            status.put("api_available", false);
            return status;
        }
    }

    private UserAgentParserPrediction calibrateConfidence(
        UserAgentParserPrediction prediction,
        PatternAnalysis analysis,
        Context context
    ) {
        double confidence = prediction.getConfidence();
        
        /* Strong Confidence */
        if(analysis.hasStrongEvidence()) confidence += 0.2;
        if(context.hasMultipleCorrelations()) confidence += 0.15;
        if(analysis.hasVersionInformation()) confidence += 0.1;

        /* Reduce Confidence */
        if(analysis.hasConflictPatterns()) confidence -= 0.2;
        if(context.isUnusualCombination()) confidence -= 0.15;
        if(context.isLikelyBot()) confidence -= 0.3;

        return prediction.withAdjustedConfidence(Math.max(0.1, Math.min(1.0, confidence)));
    }

    private UserAgentParserPrediction fallbackAnalysis(String userAgent) {
        UserAgentParserPrediction prediction = new UserAgentParserPrediction();
        prediction.setBrowser("Unknown");
        prediction.setOs("Unknown");
        prediction.setDeviceType("Unknown");
        prediction.setDeviceBrand("Unknown");
        prediction.setConfidence(0.1);
        prediction.setReasoning("Fallback analysis - API unavailable");
        return prediction;
    }
}
