const path = require('path');
const fs = require('fs');
const { encrypt } = require('./encrypt-url');

const appEnv = process.env.APP_ENV || 'dev';
const envPath = path.join(__dirname, '..', '.env-config', `.env.${appEnv}`);

console.log('APP_ENV:', appEnv);
console.log('Looking for .env at:', envPath);
console.log('.env exists?', fs.existsSync(envPath));

if(!fs.existsSync(envPath)) {
    if (!process.env.ENCRYPTION_MASTER_KEY || !process.env.API_URL || 
        !process.env.SERVER_URL || !process.env.WEB_URL) {
        console.error('ERROR: Required environment variables not set');
        console.error('Required: ENCRYPTION_MASTER_KEY, API_URL, SERVER_URL, WEB_URL');
        process.exit(1);
    }
} else {
    require('dotenv').config({ path: envPath });
}


console.log('Looking for .env at:', envPath);
console.log('.env exists?', fs.existsSync(envPath));

require('dotenv').config({ path: envPath });

const encryptionKey = process.env.ENCRYPTION_MASTER_KEY;

if(!encryptionKey) {
    console.error('ERROR: ENCRYPTION_MASTER_KEY not found in .env');
    process.exit(1);
}

const keyBuffer = Buffer.from(encryptionKey, 'base64');
console.log('Encryption key length:', keyBuffer.length, 'bytes');

if(keyBuffer.length !== 32) {
    console.error('ERROR: ENCRYPTION_MASTER_KEY must be 32 bytes (256 bits) for AES-256');
    console.error('Current length:', keyBuffer.length, 'bytes');
    process.exit(1);
}

const encryptedApiUrl = encrypt(process.env.API_URL, encryptionKey);
const encryptedServerUrl = encrypt(process.env.SERVER_URL, encryptionKey);
const encryptedWebUrl = encrypt(process.env.WEB_URL, encryptionKey);

const config = `
//
// Auto-generated from .env - DO NOT EDIT MANUALLY
// Values are encrypted
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
            window.API_GATEWAY_URL = await decrypt(window.ENCRYPTED_CONFIG.apiGateway);
            window.SERVER_API_URL = await decrypt(window.ENCRYPTED_CONFIG.serverApi);
            window.WEB_URL = await decrypt(window.ENCRYPTED_CONFIG.webUrl);
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
console.log('configuration generated at:', outputPath);