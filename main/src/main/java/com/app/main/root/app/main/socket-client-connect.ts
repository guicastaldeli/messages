import { EventDiscovery } from "./event-discovery";
import { Client } from '@stomp/stompjs';
import { SubscriptionManager, SubscriptionOptions } from "./subscription-manager";
import SockJS from 'sockjs-client';

export class SocketClientConnect {
    private static instance: SocketClientConnect;
    private subscriptionManager: SubscriptionManager;
    private client: Client | null = null;
    private eventListeners: Map<string, Function[]> = new Map();
    private reconnectAttemps = 0;
    private maxReconnectAttemps = 5;
    private connectionPromise: Promise<void> | null = null;
    private socketId: string | null = null;
    private userId: string | null = null;
    public eventDiscovery: EventDiscovery;

    private resConnection: ((value: void) => void) | null = null;
    private rejConnection: ((reason?: any) => void) | null = null;

    constructor() {
        this.eventDiscovery = new EventDiscovery();
        this.subscriptionManager = new SubscriptionManager(this.client!);
    }

    public static getInstance(): SocketClientConnect {
        if(!SocketClientConnect.instance) SocketClientConnect.instance = new SocketClientConnect;
        return SocketClientConnect.instance;
    }


    public async connect(): Promise<void> {
        if(this.connectionPromise) return this.connectionPromise;

        this.connectionPromise = new Promise(async (res, rej) => {
            this.resConnection = res;
            this.rejConnection = rej;

            try {
                const url = process.env.NEXT_PUBLIC_SERVER_ALT_URL;
                if(!url) throw new Error("SERVER URL not avaliable. FATAL ERR.");
                console.log('%cConnecting to:', 'color: #229200ff; font-weight: bold', url);
                
                if(this.client) {
                    this.client.deactivate();
                    this.client = null;
                }

                this.client = new Client({
                    webSocketFactory: () => new SockJS(url),
                    reconnectDelay: 5000,
                    heartbeatIncoming: 4000,
                    heartbeatOutgoing: 4000,

                    onConnect: async () => {
                        console.log('%cConnected to Server ;)', 'color: #004db2ff; font-weight: bold');
                        this.reconnectAttemps = 0;

                        this.subscriptionManager.updateClient(this.client);
                        await this.subscriptionManager.resubscribeAutoSubscriptions();

                        this.eventDiscovery.events();
                        await this.getSocketId();

                        if(this.resConnection) {
                            this.resConnection();
                            this.resConnection = null;
                        }
                    },
                    onStompError: (frame) => {
                        console.error('Server error!: ', frame.headers['message'], frame.body);
                    },
                    onWebSocketClose: (e) => {
                        console.log('%cConnection closed ;(', 'color: #992a24ff; font-weight: bold', e);
                        this.connectionPromise = null;
                        if(e.code !== 1000) this.handleReconnect();
                    },
                    onWebSocketError: (e) => {
                        console.error('Connection Error!: ', e);
                        this.connectionPromise = null;
                        if(this.rejConnection) {
                            this.rejConnection(e);
                            this.rejConnection = null;
                        }
                    }
                });
                
                this.client.activate();
            } catch(err) {
                this.connectionPromise = null;
                if(this.rejConnection) {
                    this.rejConnection(err);
                    this.rejConnection = null;
                }
            }
        });

        return this.connectionPromise;
    }

    /**
     * Setup Subscriptions
     */
    public async onDestination(
        destination: string,
        callback: Function,
        options?: SubscriptionOptions
    ): Promise<void> {
        return this.subscriptionManager.onDestination(destination, callback, options);
    }

    public offDestination(destination: string, callback?: Function): void {
        this.subscriptionManager.offDestination(destination, callback);
    }

    public async sendToDestination(
        destination: string,
        data?: any,
        resDestination?: string
    ): Promise<boolean> {
        if(!this.client || !this.client.connected) {
            console.error('Client not connected!');
            return false;
        }

        this.client.publish({
            destination: destination,
            body: JSON.stringify(data),
            headers: {
                'content-type': 'application/json'
            }
        });

        if(resDestination) {
            const resEvent = `res-${this.subscriptionManager.destinationToEventName(destination)}`;
            await this.onDestination(resDestination, (data: any) => {
                this.subscriptionManager.emitToEvent(resEvent, data);
            });
        }

        return true;
    }

    /**
     * Request Response
     */
    public async requestResponse(
        destination: any,
        data?: any,
        resDestination?: string
    ): Promise<any> {
        if(!this.client || !this.client.connected) {
            console.error('Client not connected!');
            throw new Error('Client not connected!');
        }

        console.log('Request to:', destination, 'Data:', data);
        return new Promise((res, rej) => {
            if(!resDestination) {
                rej(new Error('Response destinaton is required!'));
                return;
            }

            const timeout = setTimeout(() => {
                console.error('Request timeout for:', destination);
                this.offDestination(resDestination, handler);
                rej(new Error('Request timeout'));
            }, 20000);

            const handler = (data: any) => {
                clearTimeout(timeout);
                this.offDestination(resDestination, handler);
                console.log('Response received for:', destination, data);
                res(data);
            }

            this.onDestination(resDestination, handler).then(() => {
                this.client!.publish({
                    destination: destination,
                    body: JSON.stringify(data),
                    headers: {
                        'content-type': 'application/json'
                    }
                });
            }).catch(err => {
                clearTimeout(timeout);
                rej(err)
            });
        });
    }

    /**
     * Handle Reconnect
     */
    private handleReconnect(): void {
        if(this.reconnectAttemps < this.maxReconnectAttemps) {
            this.reconnectAttemps++;
            const delay = 3000 * this.reconnectAttemps;
            console.log(`Reconnecting in ${delay}ms... (${this.reconnectAttemps}/${this.maxReconnectAttemps})`);

            setTimeout(() => {
                this.connect().catch(console.error);
            }, delay);
        } else {
            console.error('Max reconnection attemps reached!');
        }
    }

    /**
     * On
     */
    public async on(event: string, callback: Function): Promise<void> {
        if(!this.eventListeners.has(event)) this.eventListeners.set(event, []);
        this.eventListeners.get(event)!.push(callback);
    }

    /**
     * Off
     */
    public off(event: string, callback: Function): void {
        const listeners = this.eventListeners.get(event);
        if(listeners) {
            const i = listeners.indexOf(callback);
            if(i > -1) listeners.splice(i, 1);
        }
    }

    /**
     * Emit
     */
    private async getEventEmit(event: string, data?: any): Promise<void> {
        let available = await this.eventDiscovery.isEventAvailable(event);

        if(!available) {
            await this.eventDiscovery.refreshEvents();
            available = await this.eventDiscovery.isEventAvailable(event);
        }
        
        if(available) {
            const listeners = this.eventListeners.get(event);
            if(listeners) {
                listeners.forEach(callback => {
                    try {
                        callback(data);
                    } catch(err) {
                        console.error(`Error in event listener for ${event}:`, err);
                    }
                });
            }
        } else {
            console.error('Event not available!!');
            return;
        }
    }

    public async emit(event: string, data?: any): Promise<boolean> {
        this.getEventEmit(event, data);
        return true;
    }

    /**
     * Send
     */
    private async getEventSend(event: string, data?: any): Promise<void> {
        let available = await this.eventDiscovery.isEventAvailable(event);

        if(!available) {
            await this.eventDiscovery.refreshEvents();
            available = await this.eventDiscovery.isEventAvailable(event);
        }

        if(available) {
            if(this.client && this.client.connected) {
                const destination = `/app/${event}`;
                const msgBody = JSON.stringify(data);
                console.log('Sending: ', destination, " data: ", data);
                this.client.publish({
                    destination: destination,
                    body: msgBody
                });
            } else {
                console.error('Client not connected!, message error', event);
            }
        } else {
            console.error('Event not available');
            return;
        }
    }

    public async send(event: string, data?: any): Promise<boolean> {
        const isValid = await this.eventDiscovery.isEventAvailable(event);
        if(!isValid) {
            console.error(`Event ${event} is not available on the Server.`);
            return false;
        }
        
        this.getEventSend(event, data);
        return true;
    }

    /**
     * Disconnect
     */
    public disconnect(): void {
        if(this.client) {
            this.client.deactivate();
            this.client = null;
        }
        this.connectionPromise = null;
        this.eventListeners.clear();
    }

    /**
     * Socket Id
     */
    public async getSocketId(): Promise<string> {
        if(this.socketId) return Promise.resolve(this.socketId);
        
        return new Promise(async (res, rej) => {
            const resDestination = '/queue/socket-id';

            const handle = (data: any) => {
                if(data && data.socketId) {
                    this.socketId = data.socketId;
                    this.offDestination(resDestination, handle);
                    res(this.socketId!);
                } else {
                    this.offDestination(resDestination, handle);
                    rej(new Error('Invalid socket id response'));
                }
            }

            await this.onDestination(resDestination, handle);
            this.sendToDestination('/app/get-socket-id', {}).then(sucss => {
                if(!sucss) {
                    this.offDestination(resDestination, handle);
                    rej(new Error('Failed to send socket request'));
                }
            }).catch(err => {
                this.offDestination(resDestination, handle);
                rej(err);
            });
        });
    }

    /**
     * User Id
     */
    public async getUserId(): Promise<string> {
        if(this.userId) return Promise.resolve(this.userId);
        
        return new Promise(async (res, rej) => {
            const resDestination = '/queue/user-id';

            const handle = (data: any) => {
                if(data && data.userId) {
                    this.userId = data.userId;
                    this.offDestination(resDestination, handle);
                    res(this.userId!);
                } else {
                    this.offDestination(resDestination, handle);
                    rej(new Error('Invalid user id response'));
                }
            }

            await this.onDestination(resDestination, handle);
            this.sendToDestination('/app/get-user-id', {}).then(sucss => {
                if(!sucss) {
                    this.offDestination(resDestination, handle);
                    rej(new Error('Failed to send user request'));
                }
            }).catch(err => {
                this.offDestination(resDestination, handle);
                rej(err);
            });
        });
    }

    /**
     * Username
     */
    public async getUsername(): Promise<string> {
        if(this.userId) return Promise.resolve(this.userId);
        
        return new Promise(async (res, rej) => {
            const resDestination = '/queue/username';

            const handle = (data: any) => {
                if(data && data.userId) {
                    this.userId = data.userId;
                    this.offDestination(resDestination, handle);
                    res(this.userId!);
                } else {
                    this.offDestination(resDestination, handle);
                    rej(new Error('Invalid username response'));
                }
            }

            await this.onDestination(resDestination, handle);
            this.sendToDestination('/app/get-username', {}).then(sucss => {
                if(!sucss) {
                    this.offDestination(resDestination, handle);
                    rej(new Error('Failed to send user request'));
                }
            }).catch(err => {
                this.offDestination(resDestination, handle);
                rej(err);
            });
        });
    }

    /**
     * Getters
     */
    public get isConnected(): boolean {
        return this.client?.connected || false;
    }

    public get readyState(): number {
        const connected = this.client?.connected;
        const OPEN = 1;
        const CLOSED = 3;
        return connected ? OPEN : CLOSED;
    }
}