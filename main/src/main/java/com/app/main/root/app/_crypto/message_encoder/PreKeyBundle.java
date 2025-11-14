package com.app.main.root.app._crypto.message_encoder;

public class PreKeyBundle {
    public int registrationId;
    public int deviceId;
    public byte[] identityKey;
    public byte[] signedPreKey;
    public byte[] signature;
    public int preKeyId;
    public byte[] preKey;
    
    public PreKeyBundle() {}
    
    public PreKeyBundle(
        int registrationId, 
        int deviceId, 
        byte[] identityKey, 
        byte[] signedPreKey, 
        byte[] signature, 
        int preKeyId, 
        byte[] preKey
    ) {
        this.registrationId = registrationId;
        this.deviceId = deviceId;
        this.identityKey = identityKey;
        this.signedPreKey = signedPreKey;
        this.signature = signature;
        this.preKeyId = preKeyId;
        this.preKey = preKey;
    }
    
    public int getRegistrationId() { return registrationId; }
    public void setRegistrationId(int registrationId) { this.registrationId = registrationId; }
    
    public int getDeviceId() { return deviceId; }
    public void setDeviceId(int deviceId) { this.deviceId = deviceId; }
    
    public byte[] getIdentityKey() { return identityKey; }
    public void setIdentityKey(byte[] identityKey) { this.identityKey = identityKey; }
    
    public byte[] getSignedPreKey() { return signedPreKey; }
    public void setSignedPreKey(byte[] signedPreKey) { this.signedPreKey = signedPreKey; }
    
    public byte[] getSignature() { return signature; }
    public void setSignature(byte[] signature) { this.signature = signature; }
    
    public int getPreKeyId() { return preKeyId; }
    public void setPreKeyId(int preKeyId) { this.preKeyId = preKeyId; }
    
    public byte[] getPreKey() { return preKey; }
    public void setPreKey(byte[] preKey) { this.preKey = preKey; }
}