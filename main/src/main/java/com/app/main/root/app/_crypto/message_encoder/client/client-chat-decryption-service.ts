import { SessionData, SessionKeysManager } from "./session-keys-manager";

export class ClientChatDecryptionService {
    private sessionKeysManager: SessionKeysManager;

    constructor(sessionKeysManager: SessionKeysManager) {
        this.sessionKeysManager = sessionKeysManager;
    }

    public async init(): Promise<void> {
        await this.sessionKeysManager.loadSessions();
    }

    /*
    ** Decrypt Message - Fixed for C++ Signal Protocol format
    */
    public async decryptMessage(chatId: string, encryptedBytes: number[] | string): Promise<string> {
        console.log('Decrypting message for chat:', chatId);
        
        try {
            const session = this.sessionKeysManager.getSession(chatId);
            if(!session || !session.sessionKey) {
                console.log('No session or session key for chat:', chatId);
                return `[Encrypted - No Session for ${chatId}]`;
            }

            const encryptedArray = await this.parseEncryptedData(encryptedBytes);
            
            console.log('Total encrypted data length:', encryptedArray.length, 'bytes');
            
            // Parse the C++ Signal Protocol format
            if (encryptedArray.length < 4) {
                throw new Error('Data too short for message counter');
            }

            // Extract message counter (first 4 bytes, big-endian)
            const messageCounter = new DataView(encryptedArray.buffer).getUint32(0, false);
            console.log('Message counter from header:', messageCounter);

            // The remaining data is standard AES-GCM
            const aesGcmData = encryptedArray.slice(4);
            console.log('AES-GCM data length:', aesGcmData.length, 'bytes');

            if (aesGcmData.length < 28) {
                console.warn('AES-GCM data shorter than expected minimum:', aesGcmData.length);
            }

            const decryptedContent = await this.decryptAesGcm(session, aesGcmData);
            console.log('✅ Successfully decrypted message with counter', messageCounter);
            return decryptedContent;
            
        } catch (err) {
            console.error('Decryption failed:', err);
            return '[Decryption Failed]';
        }
    }

    /*
    ** Decrypt standard AES-GCM data (without message counter header)
    */
    private async decryptAesGcm(session: SessionData, encryptedData: Uint8Array): Promise<string> {
        try {
            const key = await crypto.subtle.importKey(
                'raw',
                session.sessionKey!,
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );

            // Standard AES-GCM structure: 12-byte IV + ciphertext + 16-byte auth tag
            if (encryptedData.length < 12 + 16) {
                throw new Error(`AES-GCM data too short: ${encryptedData.length} bytes (need at least 28)`);
            }

            const iv = encryptedData.slice(0, 12);
            const ciphertextWithTag = encryptedData.slice(12);
            
            console.log('AES-GCM parameters:', {
                ivLength: iv.length,
                ciphertextWithTagLength: ciphertextWithTag.length,
                totalDataLength: encryptedData.length
            });

            const decrypted = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                key,
                ciphertextWithTag
            );
            
            return new TextDecoder().decode(decrypted);
        } catch (error) {
            console.error('AES-GCM decryption error:', error);
            throw error;
        }
    }

    /*
    ** Parse Encrypted Data - Updated for the actual format
    */
    private async parseEncryptedData(encryptedData: number[] | string): Promise<Uint8Array> {
        if(typeof encryptedData === 'string') {
            console.log('Processing Base64 string, length:', encryptedData.length);
            
            let decoded = this.base64ToUint8Array(encryptedData);
            console.log('After Base64 decode:', decoded.length, 'bytes');
            
            // The C++ format should be at least 4 bytes (counter) + 28 bytes (min AES-GCM)
            if(decoded.length < 32) {
                console.warn('Data shorter than expected C++ format');
            }
            
            return decoded;
        } else {
            console.log('Processing number array, length:', encryptedData.length);
            return new Uint8Array(encryptedData);
        }
    }

    /*
    ** Should Decrypt - Updated for C++ format detection
    */
    public shouldDecrypt(
        content: string,
        contentBytes: number[] | string | null,
        chatId: string
    ): boolean {
        if(!this.sessionKeysManager.hasSession(chatId)) {
            console.log(`No session for chat: ${chatId}`);
            return false;
        }

        if(!contentBytes) {
            console.log(`No content bytes for chat: ${chatId}`);
            return false;
        }

        // Check if content is explicitly marked as encrypted
        const isExplicitlyEncrypted = 
            content === '[Encrypted]' ||
            content === '[ENCRYPTED]';

        // For C++ format, we need at least 32 bytes total
        const hasProperLength = this.hasCppEncryptedFormat(contentBytes);

        console.log(`Should decrypt (C++ format):`, {
            chatId,
            hasSession: true,
            contentPreview: content?.substring(0, 30),
            contentBytesLength: typeof contentBytes === 'string' ? contentBytes.length : contentBytes?.length,
            isExplicitlyEncrypted,
            hasProperLength
        });

        return isExplicitlyEncrypted && hasProperLength;
    }

    private hasCppEncryptedFormat(contentBytes: number[] | string): boolean {
        try {
            let bytes: Uint8Array;
            
            if(typeof contentBytes === 'string') {
                bytes = this.base64ToUint8Array(contentBytes);
            } else {
                bytes = new Uint8Array(contentBytes);
            }
            
            // C++ Signal Protocol format: 4-byte counter + AES-GCM data (min 28 bytes)
            return bytes.length >= 32;
        } catch (e) {
            return false;
        }
    }

    /*
    ** Base64 decoding
    */
    private base64ToUint8Array(base64: string): Uint8Array {
        try {
            let paddedBase64 = base64;
            while (paddedBase64.length % 4 !== 0) {
                paddedBase64 += '=';
            }

            const binaryString = atob(paddedBase64);
            const bytes = new Uint8Array(binaryString.length);
            for(let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes;
        } catch (error) {
            console.error('Base64 decoding failed:', error);
            throw new Error('Invalid Base64 data');
        }
    }

    /*
    ** Debug method to analyze the encrypted data structure
    */
    public async analyzeEncryptedData(chatId: string, contentBytes: any): Promise<void> {
        console.log('=== C++ ENCRYPTED DATA ANALYSIS ===');
        console.log('Chat ID:', chatId);
        console.log('ContentBytes type:', typeof contentBytes);
        
        if(typeof contentBytes === 'string') {
            console.log('Base64 string length:', contentBytes.length);
            const decoded = this.base64ToUint8Array(contentBytes);
            console.log('Decoded binary length:', decoded.length);
            
            // Analyze C++ Signal Protocol format
            if (decoded.length >= 4) {
                const messageCounter = new DataView(decoded.buffer).getUint32(0, false);
                console.log('Message counter (first 4 bytes):', messageCounter);
                console.log('Message counter hex:', this.bytesToHex(decoded.slice(0, 4)));
            }
            
            if (decoded.length > 4) {
                const aesGcmData = decoded.slice(4);
                console.log('AES-GCM data length:', aesGcmData.length);
                console.log('AES-GCM first 20 bytes:', this.bytesToHex(aesGcmData.slice(0, 20)));
                
                if (aesGcmData.length >= 12) {
                    console.log('IV (first 12 bytes of AES-GCM):', this.bytesToHex(aesGcmData.slice(0, 12)));
                }
                
                if (aesGcmData.length >= 28) {
                    console.log('Auth tag (last 16 bytes):', this.bytesToHex(aesGcmData.slice(-16)));
                }
            }
            
            console.log('Full hex dump:', this.bytesToHex(decoded));
            
            if(decoded.length < 32) {
                console.error('❌ DATA TOO SHORT FOR C++ FORMAT - NEEDS 32+ BYTES');
            } else {
                console.log('✅ Data length OK for C++ Signal Protocol format');
            }
        } else {
            console.log('Number array length:', contentBytes.length);
            console.log('First 20 bytes:', contentBytes.slice(0, 20));
            
            if (contentBytes.length >= 4) {
                const messageCounter = new DataView(new Uint8Array(contentBytes).buffer).getUint32(0, false);
                console.log('Message counter:', messageCounter);
            }
        }
        
        console.log('=== END ANALYSIS ===');
    }

    /*
    ** Alternative decryption methods for testing
    */
    public async tryAlternativeDecryption(chatId: string, encryptedBytes: number[] | string): Promise<string> {
        console.log('Trying alternative decryption approaches for:', chatId);
        
        const encryptedArray = await this.parseEncryptedData(encryptedBytes);
        const session = this.sessionKeysManager.getSession(chatId);
        
        if (!session || !session.sessionKey) {
            return '[No Session]';
        }

        // Try different IV sizes in case the C++ implementation is different
        const attempts = [
            { name: 'C++ Standard', ivSize: 12, sliceStart: 4 },
            { name: 'No Header', ivSize: 12, sliceStart: 0 },
            { name: '16-byte IV', ivSize: 16, sliceStart: 4 },
        ];

        for (const attempt of attempts) {
            try {
                console.log(`Trying ${attempt.name}...`);
                const dataToDecrypt = encryptedArray.slice(attempt.sliceStart);
                
                if (dataToDecrypt.length < attempt.ivSize + 16) {
                    continue;
                }

                const key = await crypto.subtle.importKey(
                    'raw',
                    session.sessionKey!,
                    { name: 'AES-GCM' },
                    false,
                    ['decrypt']
                );

                const iv = dataToDecrypt.slice(0, attempt.ivSize);
                const ciphertextWithTag = dataToDecrypt.slice(attempt.ivSize);

                const decrypted = await crypto.subtle.decrypt(
                    {
                        name: 'AES-GCM',
                        iv: iv
                    },
                    key,
                    ciphertextWithTag
                );
                
                const result = new TextDecoder().decode(decrypted);
                console.log(`✅ SUCCESS with ${attempt.name}: "${result}"`);
                return result;
            } catch (error) {
                console.log(`❌ Failed with ${attempt.name}`);
            }
        }

        return '[All decryption attempts failed]';
    }

    /*
    ** Utility methods
    */
    private bytesToHex(bytes: Uint8Array): string {
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' ');
    }

    private isGarbledText(text: string): boolean {
        if(!text || text.length === 0) return false;

        let unusualCount = 0;
        for(let i = 0; i < Math.min(text.length, 50); i++) {
            const charCode = text.charCodeAt(i);
            if(charCode === 0 || (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13)) {
                unusualCount++;
            }
        }

        const unusualRatio = unusualCount / Math.min(text.length, 50);
        return unusualRatio > 0.3;
    }

    /*
    ** Get available chats with sessions
    */
    public getAvailableChats(): string[] {
        return this.sessionKeysManager.getAvailableChats();
    }

    /*
    ** Check if session exists for chat
    */
    public hasSession(chatId: string): boolean {
        return this.sessionKeysManager.hasSession(chatId);
    }
}