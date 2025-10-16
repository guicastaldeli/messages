package com.app.main.root.app.__controllers;

public class UserAgentParserPrediction {
    private String browser;
    private String os;
    private String deviceType;
    private String deviceBrand;
    private double confidence;
    private String reasoning;

    public UserAgentParserPrediction() {
        this.confidence = 0.5;
        this.reasoning = "Initial prediction";
    }

    public static UserAgentParserPrediction unknown() {
        UserAgentParserPrediction prediction = new UserAgentParserPrediction();
        String msg = "Unknown **Fallback Prediction Server";

        prediction.browser = msg;
        prediction.os = msg;
        prediction.deviceType = msg;
        prediction.deviceBrand = msg;
        prediction.confidence = 0.1;
        prediction.reasoning = "API analysis failed!";
        return prediction;
    }

    public UserAgentParserPrediction withAdjustedConfidence(double newConf) {
        this.confidence = newConf;
        return this;
    }

    public void adjustConfidence(double delta) {
        this.confidence = Math.max(0.1, Math.min(1.0, this.confidence + delta));
    }

    /*
    * Browser 
    */
    public void setBrowser(String browser) {
        this.browser = browser;
    }
    public String getBrowser() {
        return browser;
    }

    /*
    * OS 
    */
    public void setOs(String os) {
        this.os = os;
    }
    public String getOs() {
        return os;
    }

    /*
    * Device Type
    */
    public void setDeviceType(String type) {
        this.deviceType = type;
    }
    public String getDeviceType() {
        return deviceType;
    }

    /*
    * Device Brand 
    */
    public void setDeviceBrand(String brand) {
        this.deviceBrand = brand;
    }
    public String getDeviceBrand() {
        return deviceBrand;
    } 

    /*
    * Confidence 
    */
    public void setConfidence(double confidence) {
        this.confidence = confidence;
    }
    public double getConfidence() {
        return confidence;
    }

    /*
    * Reasoning 
    */
    public void setReasoning(String reasoning) {
        this.reasoning = reasoning;
    }
    public String getReasoning() {
        return reasoning;
    }
}
