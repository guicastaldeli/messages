package com.app.main.root.app.file_compressor;

public class WithCompressionResult {
    private final byte[] data;
    private final int compressionType;
    
    public WithCompressionResult(byte[] data, int compressionType) {
        this.data = data;
        this.compressionType = compressionType;
    }
    
    public byte[] getData() {
        return data;
    }
    
    public int getCompressionType() {
        return compressionType;
    }
}
