//
// Auto-generated from .env.dev - DO NOT EDIT MANUALLY
// Values are encrypted
// Generated at: 2026-10-08T13:00:25.145Z
//

window.ENCRYPTED_CONFIG = {
    apiGateway: '990ce5c5d19f259024b3f3071b491e15:24b5ec362fcb02abcfe9f788617aac0b66970797028524c3c87f5608b39fccae',
    serverApi: '58f187d3cf092e6b2c7ecc26eefaa140:7a04051ec1c14e75e5f3c60bf293ed0036ccb3274752dfca4f310ac553e10eb6',
    webUrl: 'efedeb7972263a6b2fc82e08caac194e:4ca23985908f252578d22ccee36aeb2267710b8177dc71d1934cd47c036c49c7',
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