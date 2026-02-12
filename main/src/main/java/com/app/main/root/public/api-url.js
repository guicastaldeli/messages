//
// Auto-generated from .env - DO NOT EDIT MANUALLY
// Values are encrypted
//

window.ENCRYPTED_CONFIG = {
    apiGateway: '135d92cd97809f5c6a372a2eb6fc4fa3:8386c791949123eccf8b8013a376f84a3c7014b295e45a6f9ab27736ea260c48',
    serverApi: '95b03daccfd7a63ba767a90c89c9ff8b:f2aa14f236524d07813d8939d3abaec0f215cdfdcf1586f4fff0cab5220c1e5b',
    webUrl: 'bda21a957a90a32e3dce8a02654e279b:59d3e15e113fae3c7f01ada3e7016ed4e0a862c0d024c0030763db3968430cb6',
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