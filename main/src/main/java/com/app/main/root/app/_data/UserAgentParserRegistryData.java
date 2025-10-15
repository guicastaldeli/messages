package com.app.main.root.app._data;

import java.util.List;
import java.util.Map;

public class UserAgentParserRegistryData {
    private List<Map<String, Object>> devices;
    private List<Map<String, Object>> browsers;
    private List<Map<String, Object>> os;
    private List<Map<String, Object>> rules;

    /*
    * Devices 
    */
    public void setDevices(List<Map<String, Object>> devices) {
        this.devices = devices;
    }
    public List<Map<String, Object>> getDevices() {
        return devices;
    }

    /*
    * Browsers 
    */
    public void setBrowsers(List<Map<String, Object>> browsers) {
        this.browsers = browsers;
    }
    public List<Map<String, Object>> getBrowsers() {
        return browsers;
    }

    /*
    * OS 
    */
    public void setOs(List<Map<String, Object>> os) {
        this.os = os;
    }
    public List<Map<String, Object>> getOs() {
        return os;
    }

    /*
    * Rules 
    */
    public void setRules(List<Map<String, Object>> rules) {
        this.rules = rules;
    }
    public List<Map<String, Object>> getRules() {
        return rules;
    }
}
