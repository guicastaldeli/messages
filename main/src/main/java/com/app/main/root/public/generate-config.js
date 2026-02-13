const path = require('path');
const fs = require('fs');
const { encrypt } = require('./encrypt-url');

const appEnv = process.env.APP_ENV || 'dev';
const envPath = path.join(__dirname, '..', '.env-config', `.env.${appEnv}`);

console.log('APP_ENV:', appEnv);
console.log('Looking for .env at:', envPath);
console.log('.env exists?', fs.existsSync(envPath));

if(!process.env.API_URL || !process.env.SERVER_URL || !process.env.WEB_URL) {
    console.log('Environment variables not found, loading from .env file...');
    
    if (!fs.existsSync(envPath)) {
        console.error('ERROR: .env file not found and environment variables not set');
        console.error('Required: ENCRYPTION_MASTER_KEY, API_URL, SERVER_URL, WEB_URL');
        process.exit(1);
    }
    
    require('dotenv').config({ path: envPath });
} else {
    console.log(' Using environment variables (production mode)');
}

const encryptionKey = process.env.ENCRYPTION_MASTER_KEY;
const apiUrl = process.env.API_URL;
const serverUrl = process.env.SERVER_URL;
const webUrl = process.env.WEB_URL;

console.log('=== Configuration Values ===');
console.log('API_URL:', apiUrl);
console.log('SERVER_URL:', serverUrl);
console.log('WEB_URL:', webUrl);
console.log('===========================');

if (!encryptionKey) {
    console.error('ERROR: ENCRYPTION_MASTER_KEY not found');
    process.exit(1);
}

if (!apiUrl || !serverUrl || !webUrl) {
    console.error('ERROR: Missing required URLs');
    console.error('API_URL:', apiUrl);
    console.error('SERVER_URL:', serverUrl);
    console.error('WEB_URL:', webUrl);
    process.exit(1);
}

const keyBuffer = Buffer.from(encryptionKey, 'base64');
console.log('Encryption key length:', keyBuffer.length, 'bytes');

if (keyBuffer.length !== 32) {
    console.error('ERROR: ENCRYPTION_MASTER_KEY must be 32 bytes (256 bits) for AES-256');
    console.error('Current length:', keyBuffer.length, 'bytes');
    process.exit(1);
}

console.log('Encrypting URLs...');
const encryptedApiUrl = encrypt(apiUrl, encryptionKey);
const encryptedServerUrl = encrypt(serverUrl, encryptionKey);
const encryptedWebUrl = encrypt(webUrl, encryptionKey);

const config = `
//
// Auto-generated from .env.${appEnv} - DO NOT EDIT MANUALLY
// Values are encrypted
// Generated at: ${new Date().toISOString()}
//

window.ENCRYPTED_CONFIG = {
    apiGateway: '${encryptedApiUrl}',
    serverApi: '${encryptedServerUrl}',
    webUrl: '${encryptedWebUrl}',
    key: '${encryptionKey}'
};

(function() {
    function hexToBytes(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for(let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }
    
    function base64ToBytes(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for(let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
    
    function bytesToUtf8(bytes) {
        return new TextDecoder().decode(bytes);
    }
    
    async function decrypt(encrypted) {
        try {
            const parts = encrypted.split(':');
            const iv = hexToBytes(parts[0]);
            const encryptedText = hexToBytes(parts[1]);
            const key = base64ToBytes(window.ENCRYPTED_CONFIG.key);
            
            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                key,
                { name: 'AES-CBC', length: 256 },
                false,
                ['decrypt']
            );
            
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-CBC', iv: iv },
                cryptoKey,
                encryptedText
            );
            
            return bytesToUtf8(new Uint8Array(decrypted));
        } catch (error) {
            console.error('Decryption error:', error);
            throw error;
        }
    }
    
    (async function() {
        try {
            window.API_URL = await decrypt(window.ENCRYPTED_CONFIG.apiGateway);
            window.SERVER_URL = await decrypt(window.ENCRYPTED_CONFIG.serverApi);
            window.WEB_URL = await decrypt(window.ENCRYPTED_CONFIG.webUrl);
            
            console.log('Config decrypted successfully');
            console.log('WEB_URL:', window.WEB_URL);
            console.log('API_URL:', window.API_URL);
            console.log('SERVER_URL:', window.SERVER_URL);
            
            if(window.configResolve) window.configResolve();
            
            delete window.ENCRYPTED_CONFIG;
        } catch (error) {
            console.error('Failed to decrypt configuration:', error);
        }
    })();
})();
`;

const outputPath = path.join(__dirname, 'api-url.js');

fs.writeFileSync(outputPath, config.trim());
console.log('Configuration generated at:', outputPath);
console.log('Environment:', appEnv);