package com.app.main.root.app.__controllers;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.app.main.root.app._data.UserAgentKnowledgeBase;
import com.app.main.root.app._data.UserAgentRegistryData;
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
            UserAgentRegistryData registryData = apiClient.fetchAllRegistryData();
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
}
