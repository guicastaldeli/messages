//
// Auto-generated from .env - DO NOT EDIT MANUALLY
// Values are encrypted
//

window.ENCRYPTED_CONFIG = {
    apiGateway: '8b2e97076d01af119163a38ddee3f2bf:c071ab07980f2cdfec7d1475d6b86c0275099130e3b8190888ee7e110630efcc',
    serverApi: 'ea151ab95ecf01784f20eeee33c18e12:df0efe8d9ac8c8cca371b7cb41436e660e1c797d5c24aaa002f239ceaebafd7b',
    webUrl: '6f26a386a09d4782498e6722cfecf0fc:7bda69eacc18c2b20dd24abf0f67cbfafc621e007eac9e3105798d18b1ebb9a5',
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