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
    ** Decrypt Message
    */
    public async decryptMessage(chatId: string, encryptedBytes: number[]): Promise<string> {
        try {
            const session = this.sessionKeysManager.getSession(chatId);
            if(!session) return `[Encrypted - No Session for ${chatId}]`;

            const encryptedArray = new Uint8Array(encryptedBytes);
            const decryptedContent = await this.decryptWithSession(session, encryptedArray);
            return decryptedContent;
        } catch(err) {
            console.error('Decryption failed!', err);
            return '[Decryption Failed]';
        }
    }

    /*
    ** Decrypt With Session
    */
    private async decryptWithSession(session: SessionData, encryptedData: Uint8Array): Promise<string> {
        const key = await crypto.subtle.importKey(
            'raw',
            session.sessionKey,
            { name: 'AES-GCM' },
            false,
            ['decrypt']
        );

        const iv = encryptedData.slice(0, 12);
        const cipherText = encryptedData.slice(12);
        const decrypted = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            key,
            cipherText
        );
        return new TextDecoder().decode(decrypted);
    }

    /*
    ** Should Decrypt
    */
    public shouldDecrypt(
        content: string,
        contentBytes: number[] | null,
        chatId: string
    ): boolean {
        return content === '[Encrypted]' &&
            contentBytes !== null &&
            contentBytes.length > 0 &&
            this.sessionKeysManager.hasSession(chatId);
    }
}