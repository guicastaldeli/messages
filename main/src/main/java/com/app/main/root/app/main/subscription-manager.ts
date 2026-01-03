import { Client, IMessage } from '@stomp/stompjs';

export interface SubscriptionOptions {
    eventName?: string;
    autoSubscribe?: boolean;
}

export interface SubscriptionRegistry {
    subscription: any;
    listenerCount: number;
    autoSubscribe: boolean;
    eventName: string;
}

export class SubscriptionManager {
    private subscriptionRegistry: Map<string, SubscriptionRegistry> = new Map();
    private eventListeners: Map<String, Function[]> = new Map();
    private client: Client | null = null;

    constructor(client: Client) {
        this.client = client;
    }

    /*
    ** Subscribe
    */
    public async ensureSubscription(
        destination: string,
        options: SubscriptionOptions = {}
    ): Promise<void> {
        if(!this.client || !this.client.connected) throw new Error('Client not connected!');
        const eventName = options.eventName || this.destinationToEventName(destination);
        if(this.subscriptionRegistry.has(destination)) {
            const registry = this.subscriptionRegistry.get(destination);
            if(registry) registry.listenerCount++
            return;
        }

        return new Promise((res, rej) => {
            try {
                const subscription = this.client!.subscribe(destination, async (msg: IMessage) => {
                    await this.handleIncomingMessage(eventName, msg);
                });

                this.subscriptionRegistry.set(destination, {
                    subscription,
                    listenerCount: 1,
                    autoSubscribe: options.autoSubscribe || false,
                    eventName
                });

                console.log('%cSubscription created for:', 'color: #00aa00; font-weight: bold', destination);
                res();
            } catch(err) {
                console.error('%cSubscription failed for:', 'color: #ff0000; font-weight: bold', destination, err);
                rej(err);
            }
        });
    }

    /*
    ** Unsubscribe
    */
    public async unsubscribeFromDestination(destination: string): Promise<void> {
        const registry = this.subscriptionRegistry.get(destination);
        if(!registry) return;
        registry.listenerCount--;

        if(registry.listenerCount <= 0) {
            registry.subscription.unsubscribe();
            this.subscriptionRegistry.delete(destination);
            console.log('%cUnsubscribed of:', 'color: #888; font-weight: bold', destination);
        } else {
            console.log('%cDecremented listener of:', 'color: #888; font-weight: bold', destination, `(count: ${registry.listenerCount})`);
        }
    }

    /*
    ** On Destination
    */
    public async onDestination(
        destination: string,
        callback: Function,
        options: SubscriptionOptions = {}
    ): Promise<void> {
        await this.ensureSubscription(destination, options);
        const eventName = options.eventName || this.destinationToEventName(destination);
        if(!this.eventListeners.has(eventName)) this.eventListeners.set(eventName, []);
        this.eventListeners.get(eventName)!.push(callback);
    }

    /*
    ** Off Destination
    */
    public offDestination(destination: string, callback?: Function): void {
        const eventName = this.destinationToEventName(destination);
        const listeners = this.eventListeners.get(eventName);
        if(listeners) {
            if(callback) {
                const i = listeners.indexOf(callback);
                if(i > -1) listeners.splice(i, 1);
            }
            if(!listeners.length) this.unsubscribeFromDestination(destination);
        }
    }

    public async emitToEvent(eventName: string, data: any): Promise<void> {
        const listeners = this.eventListeners.get(eventName);
        if(listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch(err) {
                    console.log(err);
                }
            });
        }
    }

    private async handleIncomingMessage(eventName: string, msg: IMessage): Promise<void> {
        try {
            const data = JSON.parse(msg.body);
            //console.log(eventName, msg.body)
            await this.emitToEvent(eventName, data);
        } catch(err) {
            console.error(err);
        }
    }

    public destinationToEventName(destination: string): string {
        const parts = destination.split('/');
        return parts[parts.length - 1];
    }

    public updateClient(client: Client | null): void {
        this.client = client;
    }

    /*
    ** Resubscribe
    */
    public async resubscribeAutoSubscriptions(): Promise<void> {
        for(const [destination, registry] of this.subscriptionRegistry) {
            if(registry.autoSubscribe) {
                await this.ensureSubscription(destination, {
                    eventName: registry.eventName,
                    autoSubscribe: true
                });
            }
        }
    }
}