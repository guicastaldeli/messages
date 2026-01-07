package com.app.main.root.app.utils;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import com.fasterxml.jackson.core.type.TypeReference;
import com.app.main.root.EnvConfig;
import com.app.main.root.app._data.UserAgentParserRegistryData;
import com.fasterxml.jackson.databind.ObjectMapper;

public class UserAgentParserApiClient {
    private String url = EnvConfig.get("API_URL");
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public UserAgentParserApiClient() {
        this.httpClient = HttpClient.newHttpClient();
        this.objectMapper = new ObjectMapper();
    }

    public UserAgentParserRegistryData fetchAllRegistryData() throws Exception {
        UserAgentParserRegistryData data = new UserAgentParserRegistryData();
        
        /* Devices */
        data.setDevices(fetchRegistry("/api/connection-tracker/connections/registry/devices"));
        /* Browsers */
        data.setBrowsers(fetchRegistry("/api/connection-tracker/connections/registry/browsers"));
        /* OS */
        data.setOs(fetchRegistry("/api/connection-tracker/connections/registry/os"));
        /* Rules */
        data.setRules(fetchRegistry("/api/connection-tracker/connections/registry/rules"));

        return data;
    }

    /*
    * Send Training Example 
    */
    public void sendTrainingExample(
        String userAgent,
        String browser,
        String os,
        String device
    ) throws Exception {
        String trainUrl = url + "/api/connection-tracker/connections/registry/train";
        Map<String, Object> data = new HashMap<>();
        data.put("userAgent", userAgent);
        data.put("browser", browser);
        data.put("os", os);
        data.put("device", device);
        String json = objectMapper.writeValueAsString(data);

        HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(trainUrl))
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(json))
        .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if(response.statusCode() != 200) throw new RuntimeException("Training API returned: " + response.statusCode());
    }

    /*
    * Get Status 
    */
    public Map<String, Object> getStatus() throws Exception {
        String statusUrl = url + "/api/connection-tracker/connections/registry/status";

        HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(statusUrl))
        .header("Accept", "application/json")
        .GET()
        .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if(response.statusCode() == 200) {
            return objectMapper.readValue(response.body(),
                new TypeReference<Map<String, Object>>() {});
        }
        throw new RuntimeException("Status API returned: " + response.statusCode());
    }

    /*
    * Fetch Registry 
    */
    private List<Map<String, Object>> fetchRegistry(String endpoint) throws Exception {
        String registryUrl = url + endpoint;

        HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(registryUrl))
        .header("Accept", "application/json")
        .GET()
        .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if(response.statusCode() == 200) {
            return objectMapper.readValue(response.body(),
                new TypeReference<List<Map<String, Object>>>() {});
        }
        throw new RuntimeException("\nRegistry API: " + endpoint + " returned: " + response.statusCode());
    }
}
