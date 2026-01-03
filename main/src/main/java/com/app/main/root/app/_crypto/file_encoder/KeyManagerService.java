package com.app.main.root.app._crypto.file_encoder;
import com.app.main.root.app._db.CommandQueryManager;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Value;
import java.util.Map;
import java.util.List;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Service
public class KeyManagerService {
    private final Map<String, JdbcTemplate> jdbcTemplates;
    private final SecretKey masterKey;
    private static final String CIPHER_ALGO = "AES";
    private static final String CIPHER_MODE = "AES";
    private static final int KEY_SIZE = 256;

    @Value("${encryption.master-key:}")
    private String masterKeyEnv;

    public KeyManagerService(Map<String, JdbcTemplate> jdbcTemplates) {
        this.jdbcTemplates = jdbcTemplates;
        this.masterKey = initMasterKey();
    }

    /**
     * Init Master Key
     */
    private SecretKey initMasterKey() {
        try {
            String masterKeyStr = masterKeyEnv != null && !masterKeyEnv.isEmpty()
                ? masterKeyEnv
                : System.getenv("ENCRYPTION_MASTER_KEY");

            if(masterKeyStr == null || masterKeyStr.isEmpty()) {
                System.err.println("No master key configured");
                return generateMasterKey();
            }

            byte[] decodedKey = Base64.getDecoder().decode(masterKeyStr);
            return new SecretKeySpec(decodedKey, 0, decodedKey.length, CIPHER_ALGO);
        } catch(Exception err) {
            System.err.println("Error initializing master key: " + err.getMessage());
            throw new RuntimeException("Failed to initialize master key", err);
        }
    }

    /**
     * Generate Master Key
     */
    public static String generateMasterKeyStr() {
        try {
            KeyGenerator keyGen = KeyGenerator.getInstance(CIPHER_ALGO);
            keyGen.init(KEY_SIZE);
            SecretKey key = keyGen.generateKey();
            return Base64.getEncoder().encodeToString(key.getEncoded());
        } catch(Exception err) {
            throw new RuntimeException("Failed to generate master key**", err);
        }
    }

    private SecretKey generateMasterKey() {
        try {
            KeyGenerator keyGen = KeyGenerator.getInstance(CIPHER_ALGO);
            keyGen.init(KEY_SIZE);
            return keyGen.generateKey();
        } catch(Exception err) {
            throw new RuntimeException("Failed to generate master key", err);
        }
    }

    /**
     * Store Key
     */
    public void storeKey(String fileId, String userId, byte[] encryptionKey) {
        try {
            JdbcTemplate keyTemplate = jdbcTemplates.get("file_encryption_keys");
            if(keyTemplate == null) {
                throw new RuntimeException("file_encryption_keys database not available");
            }
            
            String fileIdHash = generateHash(fileId);
            String query = CommandQueryManager.STORE_KEY.get();
            
            try {
                int rowsAffected = keyTemplate.update(query, 
                    fileId, 
                    fileIdHash, 
                    userId, 
                    encryptionKey
                );
                System.out.println("Key stored successfully. Rows affected: " + rowsAffected);
            } catch (Exception e) {
                System.err.println("Error store key" + e.getMessage());
                e.printStackTrace();
            }
        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Failed to store encryption key: " + e.getMessage(), e);
        }
    }

    private String generateHash(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return bytesToHex(hash);
        } catch (Exception e) {
            System.err.println("Error generating hash: " + e.getMessage());
            return input;
        }
    }
    
    private String bytesToHex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for(byte b : bytes) {
            result.append(String.format("%02x", b));
        }
        return result.toString();
    }

    /**
     * Retrieve Key
     */
    public byte[] retrieveKey(String fileId, String userId) {
        try {
            String query = CommandQueryManager.RETRIEVE_KEY.get();

            JdbcTemplate template = jdbcTemplates.get("file_encryption_keys");
            if(template == null) throw new RuntimeException("file_encryption_keys database not configured");

            byte[] key = template.queryForObject(
                query,
                byte[].class,
                fileId,
                userId
            );
            System.out.println("Key retrieved successfully... length: " + (key != null ? key.length : "null"));
            return key;
        } catch (Exception err) {
            System.err.println("Error retrieving encryption key: " + err.getMessage());
            throw new RuntimeException("Failed to retrieve encryption key", err);
        }
    }

    /**
     * Delete Key
     */
    public void deleteKey(String fileId, String userId) {
        try {
            String query = CommandQueryManager.DELETE_KEY.get();

            JdbcTemplate template = jdbcTemplates.get("file_encryption_keys");
            if(template == null) throw new RuntimeException("file_encryption_keys database not configured");

            template.update(query, fileId, userId);
            System.out.println("Key deleted for fileId: " + fileId);
        } catch (Exception e) {
            System.err.println("Error deleting encryption key: " + e.getMessage());
            throw new RuntimeException("Failed to delete encryption key", e);
        }
    }

    public boolean keyExists(String fileId, String userId) {
        try {
            String query = CommandQueryManager.KEY_EXISTS.get();

            JdbcTemplate template = jdbcTemplates.get("file_encryption_keys");
            if(template == null) throw new RuntimeException("file_encryption_keys database not configured");

            List<Map<String, Object>> result = template.queryForList(query, fileId, userId);
            Integer count = ((Number) result.get(0).get("count")).intValue();
            return count > 0;
        } catch (Exception err) {
            System.err.println("Error checking key existence: " + err.getMessage());
            return false;
        }
    }

    public String getMasterKeyStr() {
        return Base64.getEncoder().encodeToString(masterKey.getEncoded());
    }

    /**
     * Encrypt Key
     */
    private String encryptKey(byte[] key) {
        try {
            Cipher cipher = Cipher.getInstance(CIPHER_MODE);
            cipher.init(Cipher.ENCRYPT_MODE, masterKey);
            byte[] encryptedBytes = cipher.doFinal(key);

            return Base64.getEncoder().encodeToString(encryptedBytes);
        } catch(Exception err) {
            throw new RuntimeException("Failed to encrypt key", err);
        }
    }

    /**
     * Decrypt Key
     */
    private byte[] decryptKey(String key) {
        try {
            byte[] encryptedBytes = Base64.getDecoder().decode(key);
            Cipher cipher = Cipher.getInstance(CIPHER_MODE);
            cipher.init(Cipher.DECRYPT_MODE, masterKey);

            return cipher.doFinal(encryptedBytes);
        } catch (Exception err) {
            throw new RuntimeException("Failed to decrypt key", err);
        }
    }

    private String hashString(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes());

            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception err) {
            throw new RuntimeException("Failed to hash string", err);
        }
    }
}
