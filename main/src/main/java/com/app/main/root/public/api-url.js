//
// Auto-generated from .env.dev - DO NOT EDIT MANUALLY
// Values are encrypted
// Generated at: 2026-10-09T14:44:55.468Z
//

window.ENCRYPTED_CONFIG = {
    apiGateway: '5ed4ebb259f56a16b8eddb4f36242f83:15fe5340791683f2a3d09f2e22294eff2242e9b3c0206990b82e30b1e8a97b3a',
    serverApi: '6f9992af89cd10d458fabe5d371b0ff4:629a8af74c50d4a989fb126aaf04ea1e8f2928276303246763810d9f3a5a2cc9',
    webUrl: '64e3bec10c7f8b97db0fbe5776d200b9:fad8f1a927ec472aff528547bcef51cbfb465fd57710630c03fde4e48ee972da',
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
        } catch(error) {
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
        } catch(error) {
            console.error('Failed to decrypt configuration:', error);
        }
    })();
})();