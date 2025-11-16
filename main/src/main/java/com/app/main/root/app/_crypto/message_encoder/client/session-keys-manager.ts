import { SESSION_KEYS_DATA } from "./session-keys";

export interface SessionData {
    chatId: string;
    sessionKey: ArrayBuffer;
    algorithm: string;
    createdAt: number;
}

export class SessionKeysManager {
    private sessions: Map<string, SessionData> = new Map();
    private sessionsLoaded: boolean = false;

    /*
    ** Load Sessions
    */
    public async loadSessions(): Promise<void> {
        if(this.sessionsLoaded) return;

        try {
            console.log('Loading sessions from file');
            const binaryString = atob(SESSION_KEYS_DATA);
            const bytes = new Uint8Array(binaryString.length);
            for(let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const arrayBuffer = bytes.buffer;
            await this.parseSessionKeysFile(arrayBuffer);
            this.sessionsLoaded = true;
        } catch(err) {
            console.error('Failed to load sessions file:', err);
            this.sessionsLoaded = false;
        }
    }

    /*
    ** Parse Session Keys File
    */
    private async parseSessionKeysFile(arrayBuffer: ArrayBuffer): Promise<void> {
        const dataView = new DataView(arrayBuffer);
        let offset = 0;

        while(offset < arrayBuffer.byteLength) {
            try {
                if(offset + 4 > arrayBuffer.byteLength) {
                    console.log('Not enough bytes!', offset);
                    break;
                }

                const sessionCount = dataView.getUint32(offset, true);
                offset += 4;

                for(let i = 0; i < sessionCount; i++) {
                    if(offset + 4 > arrayBuffer.byteLength) break;
                    const idLength = dataView.getUint32(offset, true);
                    offset += 4;

                    if(offset + idLength > arrayBuffer.byteLength) break;
                    const idBytes = new Uint8Array(arrayBuffer, offset, idLength);
                    const chatId = new TextDecoder().decode(idBytes);
                    offset += idLength;

                    if(offset + 4 > arrayBuffer.byteLength) break;
                    const dataLength = dataView.getUint32(offset, true);
                    offset += 4;

                    if(offset + dataLength > arrayBuffer.byteLength) break;
                    const sessionData = arrayBuffer.slice(offset, offset + dataLength);
                    const rootKey = this.extractRootKey(sessionData, chatId);

                    this.sessions.set(chatId, {
                        chatId,
                        sessionKey: rootKey!,
                        algorithm: 'AES-GCM',
                        createdAt: Date.now()
                    });
                    console.log(`Loaded session for: ${chatId}`);
                    offset += dataLength;
                }
            } catch(err) {
                console.error('Failed parsing session entry:', err);
                break;
            }
        }
        console.log(`Loaded ${this.sessions.size} sessions`);
    }

    /*
    ** Extract Root Key
    */
    private extractRootKey(sessionData: ArrayBuffer, chatId: string): ArrayBuffer | null {
        const dataView = new DataView(sessionData);
        let offset = 0;

        try {
            if(offset + 4 > sessionData.byteLength) return null;
            const rootKeySize = dataView.getUint32(offset, true);
            offset += 4;

            if(offset + rootKeySize > sessionData.byteLength) return null;
            const rootKey = sessionData.slice(offset, offset + rootKeySize);
            return rootKey;
        } catch(err) {
            console.log('Error extracting root key', err);
            return null;
        }
    }

    public getSession(chatId: string): SessionData | null {
        return this.sessions.get(chatId) || null;
    }

    public hasSession(chatId: string): boolean {
        return this.sessions.has(chatId);
    }

    public getAvailableChats(): string[] {
        return Array.from(this.sessions.keys());
    }
}