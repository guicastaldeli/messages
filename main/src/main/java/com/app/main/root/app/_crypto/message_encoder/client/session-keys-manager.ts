export interface SessionData {
    chatId: string;
    sessionKey: ArrayBuffer;
    algorithm: string;
    createdAt: number;
}

export class SessionKeysManager {
    private sessions: Map<string, SessionData> = new Map();
    private sessionsLoaded: boolean = false;
    private url: string;

    constructor() {
        this.url = "C:/Users/casta/OneDrive/Desktop/vscode/messages/main/src/main/java/com/app/main/root/app/_crypto/message_encoder/_keys/session-keys.dat"
    }

    /*
    ** Load Sessions
    */
    public async loadSessions(): Promise<void> {
        if(this.sessionsLoaded) return;

        try {
            console.log('Loading sessions from:', `${this.url}`);
            const res = await fetch(this.url, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            if(!res.ok) {
                throw new Error(`Failed to load sessions file: ${res.status}`);
            }

            const arrayBuffer = await res.arrayBuffer();
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
                if(offset + 4 > arrayBuffer.byteLength) break;
                const chatIdLength  = dataView.getUint32(offset, true);
                offset += 4;

                const chatIdBytes = new Uint8Array(arrayBuffer, offset, chatIdLength);
                const chatId = new TextDecoder().decode(chatIdBytes);
                offset += chatIdLength;

                const keyLength = dataView.getUint32(offset, true);
                offset += 4;

                const sessionKey = arrayBuffer.slice(offset, offset + keyLength);
                offset += keyLength;

                this.sessions.set(chatId, {
                    chatId,
                    sessionKey,
                    algorithm: 'AES-GCM',
                    createdAt: Date.now()
                });
            } catch(err) {
                console.error('Failed parsing session entry:', err);
                break;
            }
        }
        console.log(`Loaded ${this.sessions.size} sessions`);
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