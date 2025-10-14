import { EventDiscovery } from "./event-discovery";
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export class SocketClientConnect {
    private static instance: SocketClientConnect;
    private client: Client | null = null;
    private eventListeners: Map<string, Function[]> = new Map();
    private reconnectAttemps = 0;
    private maxReconnectAttemps = 5;
    private connectionPromise: Promise<void> | null = null;
    private socketId: string | null = null;
    public eventDiscovery: EventDiscovery;

    private resConnection: ((value: void) => void) | null = null;
    private rejConnection: ((reason?: any) => void) | null = null;

    constructor() {
        this.eventDiscovery = new EventDiscovery();
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
                const url = process.env.NEXT_PUBLIC_SERVER_DEF_HTTP_URL;
                if(!url) throw new Error("SERVER URL not avaliable. FATAL ERR.");
                console.log('%cConnecting to:', 'color: #229200ff; font-weight: bold', url);
                
                this.client = new Client({
                    webSocketFactory: () => new SockJS(url),
                    reconnectDelay: 5000,
                    heartbeatIncoming: 4000,
                    heartbeatOutgoing: 4000,

                    onConnect: () => {
                        console.log('%cConnected to Server ;)', 'color: #004db2ff; font-weight: bold');
                        this.reconnectAttemps = 0;

                        this.setupSubscriptions();
                        this.getSocketId();
                        this.eventDiscovery.events();

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

    /*
    ** Setup Subscriptions
    */
    private async setupSubscriptions(): Promise<void> {
        if(!this.client || !this.client.connected) return;
        console.log('working!')

        this.client.subscribe('/queue/socket-id', async (msg: IMessage) => {
            await this.handleMessage('res-socket-id', msg);
        });
        this.client.subscribe('/topic/chat', async (msg: IMessage) => {
            await this.handleMessage('chat', msg);
        });
        this.client.subscribe('/topic/update', async (msg: IMessage) => {
            await this.handleMessage('update', msg);
        });
        this.client.subscribe('/topic/users', async (msg: IMessage) => {
            await this.handleMessage('users', msg);
        });
        this.client.subscribe('/user/queue/errors', async (msg: IMessage) => {
            await this.handleMessage('error', msg);
        });
    }

    /*
    ** Handle Message
    */
    private async handleMessage(e: string, msg: any): Promise<void> {
        try {
            const data = JSON.parse(msg.body);
            this.emit(e, data);
        } catch(err) {
            console.error('STOMP FATAL ERR.', err);
        }
    }

    /*
    ** Handle Reconnect
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

    /*
    ** On
    */
    public async on(event: string, callback: Function): Promise<void> {
        if(!this.eventListeners.has(event)) this.eventListeners.set(event, []);
        this.eventListeners.get(event)!.push(callback);
    }

    /*
    ** Off
    */
    public off(event: string, callback: Function): void {
        const listeners = this.eventListeners.get(event);
        if(listeners) {
            const i = listeners.indexOf(callback);
            if(i > -1) listeners.splice(i, 1);
        }
    }

    /*
    ** Emit
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

    /*
    ** Send
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

    /*
    ** Disconnect
    */
    public disconnect(): void {
        if(this.client) {
            this.client.deactivate();
            this.client = null;
        }
        this.connectionPromise = null;
        this.eventListeners.clear();
    }

    /*
    ** Socket Id
    */
    public async getSocketId(): Promise<string> {
        return new Promise((res, rej) => {
            const handle = (data: any) => {
                console.log('Received socket ID', data);
                if(data && data.socketId) {
                    this.socketId = data.socketId;
                    this.off('res-socket-id', handle);
                    res(data.socketId);
                } else {
                    rej(new Error('Invalid socket id'))
                }
            }

            this.on('res-socket-id', handle);

            this.send('get-socket-id', {}).then(sucss => {
                if(!sucss) {
                    this.off('res-socket-id', handle);
                    rej(new Error('Failed to send socket request'));
                }
            }).catch(err => {
                this.off('res-socket-id', handle);
                rej(err);
            });
            console.log(this.socketId)
        });
    }

    /*
    ** Getters
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