package com.app.main.root.app._service;
import java.util.*;

public class SystemMessageService {
    private final Map<String, String> messageTemplates = new HashMap<>();

    public String generateMessage(
        String templateKey,
        Map<String, Object> variables
    ) {
        String template = messageTemplates.get(templateKey);
        if(template == null) return "SYSTEM MESSAGE **RETURN";

        for(Map.Entry<String, Object> entry : variables.entrySet()) {
            String placeholder = "{" + entry.getKey() + "}";
            template = template.replace(placeholder, String.valueOf(entry.getValue()));
        }

        return template;
    }

    public void addCustomTemplate(String key, String template) {
        messageTemplates.put(key, template);
    }
}
