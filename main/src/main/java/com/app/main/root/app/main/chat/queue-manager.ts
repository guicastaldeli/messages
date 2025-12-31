import { SocketClientConnect } from "../socket-client-connect";

export class QueueManager {
    private subscriptions: Map<string, (data: any) => void> = new Map();

    constructor(private socketClient: SocketClientConnect) {
        this.socketClient = socketClient;
    }

    public resolvePattern(pattern: string): string {
        const patterns: Record<string, string> = {
            'CHAT': '/user/queue/messages/all',
            'SYSTEM': '/user/queue/messages/system',

            'DIRECT:*': '/user/queue/messages/direct/$1',
            'DIRECT:SELF': '/user/queue/messages/direct/$1/self',
            'DIRECT:OTHERS': '/user/queue/messages/direct/$1/others',

            'GROUP:*': '/user/queue/messages/group/$1',
            'GROUP:SELF': '/user/queue/messages/group/$1/self',
            'GROUP:OTHERS': '/user/queue/messages/group/$1/others'
        }
        if(patterns[pattern]) {
            return patterns[pattern]
        }

        for(const [key, value] of Object.entries(patterns)) {
            if(pattern.startsWith(key.replace(':*', ''))) {
                if(key.includes(':*')) {
                    const parts = pattern.split(':');
                    const param = parts[1];
                    return value.replace('$1', param);
                }
                return value;
            }
        }

        return pattern;
    }

    /*
    ** Subscribe
    */
    public async subscribe(
        pattern: string,
        handler: (data: any) => void
    ): Promise<void> {
        const destination = this.resolvePattern(pattern);
        await this.unsubscribe(pattern);

        const existingHandler = this.subscriptions.get(destination);
        if(existingHandler) this.socketClient.offDestination(destination, existingHandler);

        await this.socketClient.onDestination(destination, handler);
        this.subscriptions.set(destination, handler);
    }

    /*
    ** Unsubscribe
    */
    public async unsubscribe(pattern: string): Promise<void> {
        const destination = this.resolvePattern(pattern);
        const handler = this.subscriptions.get(destination);
        if(handler) {
            this.socketClient.offDestination(destination, handler);
            this.subscriptions.delete(destination);
        }
    }

    /*
    ** Send
    */
    public async sendWithRouting(
        payload: any,
        messageType: string,
        options?: any
    ): Promise<boolean> {
        const updPayload = {
            ...payload,
            _metadata: {
                type: messageType,
                timestamp: Date.now(),
                routing: options?.routing || 'STANDARD',
                priority: options?.priority || 'NORMAL'
            }
        }

        const res = 
        await this.socketClient.sendToDestination(
            `/app/${messageType.toLowerCase()}`,
            updPayload
        );
        return res;
    }
}