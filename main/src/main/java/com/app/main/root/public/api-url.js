//
// Auto-generated from .env - DO NOT EDIT MANUALLY
// Values are encrypted
//

window.ENCRYPTED_CONFIG = {
    apiGateway: 'd476e7962e649327a30e760db5a7efd1:13855c452c20b025eaecfffded4cdb8a1ad18ef071ebf72c0228a4dc4da0d8a5',
    serverApi: 'af0e0800e05fef32e3a8d6375e64bdba:bd007c3c40d93efe4a3465fd80020e1a38745b7b2f9cceb27892bbba89b341bb',
    webUrl: '34942b05415bc796da4931a99c4bb7a9:fa68b1dacf7e410769ae266376ffacf93a55f440e50c8f2d013a0cfa44b5c2c8',
    key: 'x63uuphvQo1qCK4Y3kh2f77iRVwnUtXckI+eeUJgGng='
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
            if(window.configResolve) window.configResolve();
            
            delete window.ENCRYPTED_CONFIG;
        } catch (error) {
            console.error('Failed to decrypt configuration:', error);
        }
    })();
})();