package com.app.main.root.app.file_compressor;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.EOFException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;

public class WrapperFileCompressor {
    private static final String DLL_PATH = "src/main/java/com/app/main/root/app/file_compressor/.build/";
    
    static {
        loadNativeLibraries();
    }
    
    private static void loadNativeLibraries() {
        try {
            Path directory = Paths.get(DLL_PATH);
            if(!Files.exists(directory)) {
                throw new RuntimeException("dll directory does not exist: " + directory.toAbsolutePath());
            }
            System.out.println("Files in dll directory:");
            try {
                Files.list(directory)
                    .filter(path -> path.toString().toLowerCase().endsWith(".dll"))
                    .forEach(path -> System.out.println("  - " + path.getFileName()));
            } catch(Exception err) {
                System.out.println("error directory" + err.getMessage());
            }

            String[] libraries = {
                "libcrypto-3-x64.dll",
                "libssl-3-x64.dll", 
                "file_compressor.dll"
            };
            
            for(String lib : libraries) {
                Path libPath = directory.resolve(lib);
                if(!Files.exists(libPath)) {
                    System.err.println("Missing required DLL: " + libPath.toAbsolutePath());
                    throw new RuntimeException("Required DLL not found: " + lib);
                }
                System.out.println("Found: " + libPath.toAbsolutePath());
            }
            for(String lib : libraries) {
                Path libPath = directory.resolve(lib);
                try {
                    System.load(libPath.toAbsolutePath().toString());
                    System.out.println("Successfully loaded: " + lib);
                } catch(UnsatisfiedLinkError e) {
                    System.err.println("Failed to load: " + lib);
                    System.err.println("Error: " + e.getMessage());
                    throw e;
                }
            }
        } catch(Exception err) {
            err.printStackTrace();
            throw new RuntimeException("Failed to load native libraries: " + err.getMessage());
        }
    }

    private static native WithCompressionResult compressNative(byte[] data);
    
    public static WithCompressionResult compress(byte[] data) throws Exception {
        try {
            System.out.println("DEBUG: Calling native compress, data length: " + data.length);
            WithCompressionResult result = compressNative(data);
            if(result == null) {
                throw new Exception("Native compression returned null");
            }
            System.out.println("DEBUG: Native compress returned, length: " + 
                result.getData().length + ", type: " + result.getCompressionType());
            return result;
        } catch(UnsatisfiedLinkError e) {
            System.err.println("ERROR: Native compress method not found: " + e.getMessage());
            throw e;
        } catch(Exception e) {
            System.err.println("ERROR: Native compress failed: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Compression failed", e);
        }
    }
    public static native byte[] decompress(byte[] data, int compressionType);
    public static native int compressFile(String inputPath, String outputPath);
    public static native int decompressFile(String inputPath, String outputPath);

    public static void compressFileWrapped(String inputPath, String outputPath) throws Exception {
        int result = compressFile(inputPath, outputPath);
        if(result < 0) {
            throw new Exception("Compression failed with error code: " + result);
        }
    }

    public static void decompressFileWrapped(String inputPath, String outputPath) throws Exception {
        int result = decompressFile(inputPath, outputPath);
        if(result < 0) {
            throw new Exception("Decompression failed with error code: " + result);
        }
    }

    public static byte[] compressData(byte[] data) throws Exception {
        WithCompressionResult result = compress(data);
        return result.getData();
    }

    public static byte[] decompressData(byte[] data, int compressionType) throws Exception {
        if(data == null || data.length == 0) {
            throw new IllegalArgumentException("Data cannot be null or empty");
        }
        if(compressionType < 0 || compressionType > 4) {
            throw new IllegalArgumentException("Invalid compression type: " + compressionType);
        }
        return decompress(data, compressionType);
    }

    public static WithCompressionResult compressStream(InputStream inputStream, long size, String mimeType) throws Exception {
        System.out.println("DEBUG: Starting stream compression for " + mimeType + ", size: " + size + " bytes");
        
        if(mimeType != null && mimeType.toLowerCase().contains("video")) {
            System.out.println("DEBUG: Video file detected, skipping compression");
            byte[] data = readFully(inputStream);
            return new WithCompressionResult(data, 0);
        }
        
        if(size < 5 * 1024 * 1024) { // < 5MB
            byte[] data = readFully(inputStream);
            return compress(data);
        }
        
        int chunkSize = 5 * 1024 * 1024;
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        
        byte[] buffer = new byte[chunkSize];
        int bytesRead;
        long totalRead = 0;
        int chunkNumber = 0;
        boolean anyCompression = false;
        
        DataOutputStream dataOutput = new DataOutputStream(output);
        dataOutput.writeLong(size);
        while((bytesRead = inputStream.read(buffer)) != -1) {
            chunkNumber++;
            System.out.println("DEBUG: Processing chunk " + chunkNumber + ", size: " + bytesRead + " bytes");
            
            boolean chunkIsCompressible = isChunkCompressible(buffer, bytesRead);
            if(!chunkIsCompressible) {
                dataOutput.writeByte(0);
                dataOutput.writeInt(bytesRead);
                dataOutput.write(buffer, 0, bytesRead);
                System.out.println("DEBUG: Chunk not compressible, storing as-is");
            } else {
                byte[] chunkData = Arrays.copyOf(buffer, bytesRead);
                WithCompressionResult chunkResult = compress(chunkData);
                
                if(chunkResult.getCompressionType() > 0) {
                    byte[] compressedChunk = chunkResult.getData();
                    dataOutput.writeByte(chunkResult.getCompressionType());
                    dataOutput.writeInt(compressedChunk.length);
                    dataOutput.write(compressedChunk);
                    anyCompression = true;
                    System.out.println("DEBUG: Chunk compressed: " + bytesRead + " -> " + compressedChunk.length + " bytes");
                } else {
                    dataOutput.writeByte(0);
                    dataOutput.writeInt(bytesRead);
                    dataOutput.write(buffer, 0, bytesRead);
                    System.out.println("DEBUG: Chunk compression not beneficial");
                }
            }
            
            totalRead += bytesRead;
            System.out.println("DEBUG: Total processed: " + totalRead + "/" + size + " bytes");
        }
        
        byte[] compressedData = output.toByteArray();
        System.out.println("DEBUG: Stream compression complete: " + size + " -> " + compressedData.length + " bytes");
        
        int finalCompressionType = anyCompression ? 10 : 0;
        return new WithCompressionResult(compressedData, finalCompressionType);
    }

    private static boolean isChunkCompressible(byte[] chunk, int length) {
        int textBytes = 0;
        int sampleSize = Math.min(length, 1000);
        
        for(int i = 0; i < sampleSize; i++) {
            byte b = chunk[i];
            if((b >= 32 && b <= 126) || b == '\t' || b == '\n' || b == '\r') {
                textBytes++;
            }
        }
        
        return textBytes * 100 / sampleSize > 70;
    }
    
    public static byte[] decompressStream(byte[] compressedData) throws Exception {
        ByteArrayInputStream input = new ByteArrayInputStream(compressedData);
        DataInputStream dataInput = new DataInputStream(input);
        
        long totalSize = dataInput.readLong();
        int chunkSize = dataInput.readInt();
        
        System.out.println("DEBUG: Decompressing stream: total size=" + totalSize + 
                         ", chunk size=" + chunkSize);
        
        ByteArrayOutputStream output = new ByteArrayOutputStream((int)totalSize);
        
        try {
            while(dataInput.available() > 0) {
                int compressedChunkSize = dataInput.readInt();
                int compressionType = dataInput.readByte() & 0xFF;
                
                byte[] compressedChunk = new byte[compressedChunkSize];
                dataInput.readFully(compressedChunk);
                
                byte[] decompressedChunk;
                if(compressionType == 10) {
                    decompressedChunk = decompressStream(compressedChunk);
                } else if(compressionType > 0) {
                    decompressedChunk = decompress(compressedChunk, compressionType);
                } else {
                    decompressedChunk = compressedChunk;
                }
                
                output.write(decompressedChunk);
            }
        } catch(EOFException e) {
            System.out.println(e);
        }
        
        byte[] result = output.toByteArray();
        System.out.println("DEBUG: Stream decompression complete: " + 
                         compressedData.length + " -> " + result.length + " bytes");
        
        return result;
    }
    
    private static byte[] readFully(InputStream inputStream) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] data = new byte[4096];
        int bytesRead;
        while((bytesRead = inputStream.read(data)) != -1) {
            buffer.write(data, 0, bytesRead);
        }
        return buffer.toByteArray();
    }
}