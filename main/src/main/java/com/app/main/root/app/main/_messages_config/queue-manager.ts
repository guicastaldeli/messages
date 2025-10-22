import { SocketClientConnect } from "../socket-client-connect";

export class QueueManager {
    private queueSubscriptions: Map<string, (data: any) => void> = new Map();
    private routingConfig: Map<string, string[]> = new Map();

    constructor(private socketClient: SocketClientConnect) {
        this.setupRoutingConfig();
    }

    /*
    ** Setup Routing
    */
    private setupRoutingConfig() {
        this.routingConfig.set('CHAT', [
            '/user/queue/messages/all'
        ]);
        this.routingConfig.set('DIRECT', [
            '/user/queue/messages/self', 
            '/user/queue/messages/others'
        ]);
        this.routingConfig.set('GROUP', [
            '/user/queue/messages/self', 
            '/user/queue/messages/others'
        ]);
        this.routingConfig.set('SYSTEM', [
            '/user/queue/messages/system',
            '/user/queue/system-message'
        ]);
    }

    /*
    ** Subscribe
    */
    public async subscribeToMessageType(
        messageType: string,
        handler: (data: any) => void
    ): Promise<void> {
        const queues = this.routingConfig.get(messageType) || [];
        for(const queue of queues) {
            await this.socketClient.onDestination(queue, handler);
            this.queueSubscriptions.set(queue, handler);
        }
    }

    /*
    ** Unsubscribe
    */
    public async unsubscribeFromMessageType(messageType: string): Promise<void> {
        const queues = this.routingConfig.get(messageType) || [];
        for(const queue of queues) {
            const handler = this.queueSubscriptions.get(queue);
            if(handler) {
                this.socketClient.offDestination(queue, handler);
                this.queueSubscriptions.delete(queue);
            }
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