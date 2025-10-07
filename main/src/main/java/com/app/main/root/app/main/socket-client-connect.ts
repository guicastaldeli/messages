import { EventDiscovery } from "./event-discovery";

export class SocketClientConnect {
    private static instance: SocketClientConnect;
    private socket: WebSocket | null = null;
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

    public connect(): Promise<void> {
        if(this.connectionPromise) return this.connectionPromise;

        this.connectionPromise = new Promise(async (res, rej) => {
            this.resConnection = res;
            this.rejConnection = rej;

            try {
                const protocol = window.location.protocol === 'http:' ? 'ws:' : 'wss:';
                const host = process.env.NEXT_PUBLIC_WS_HOST || window.location.hostname;
                const port = process.env.NEXT_PUBLIC_WS_PORT || '3001';
                const wsUrl = `${protocol}//${host}:${port}/ws-direct` ||
                `${protocol}//${host}:${port}`;

                console.log('%cConnecting to:', 'color: #229200ff; font-weight: bold', wsUrl);
                this.socket = new WebSocket(wsUrl);
                await this.setupEventListeners();
                this.eventDiscovery.events().catch(console.error);

                this.socket.onopen = () => {
                    console.log(
                        '%cConnected to the Server ;)', 'color: #004db2ff; font-weight: bold'
                    );
                    this.reconnectAttemps = 0;
                    this.getSocketId();
                }
                this.socket.onclose = (event) => {
                    console.log('WebSocket connection closed:', event.code, event.reason);
                    this.connectionPromise = null;
                    if(event.code !== 1000) this.handleReconnect();
                }
                this.socket.onerror = (err) => {
                    console.error('WebSocket error:', err);
                    this.connectionPromise = null;
                    if(this.rejConnection) {
                        this.rejConnection(err);
                        this.rejConnection = null;
                    }
                }
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
    ** Setup Event Listeners
    */
    private async setupEventListeners(): Promise<void> {
        if(!this.socket) throw new Error('FATAL ERR.');

        this.socket.onmessage = async (event) => {
            try {
                const message = JSON.parse(event.data);

                //Connect
                if(message.event === 'connect') {
                    console.log('Received message:', message);
                    if(this.resConnection) {
                        this.resConnection();
                        this.resConnection = null;
                    }
                    await this.emit(message.event, message.data);
                    console.log('tst')
                }
                //Others
                await this.emit(message.event, message.data);
            } catch(err) {
                console.error('Error parsing WebSocket message:', err);
            }
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
        if(!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(callback);
        //console.log(`Listener added for event: ${event}`);
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
            //console.log('Emitted', { event, data })
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
            if(this.socket && this.socket.readyState === WebSocket.OPEN) {
                const content = JSON.stringify({ event, data });
                //console.log('Content:', content);
                this.socket.send(content);
            } else {
                console.error('WebSocket not connected. Cannot send message:', event);
            }
        } else {
            console.error('Event not available!!');
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
        if(this.socket) {
            this.socket.close(1000, 'Manual disconnect');
            this.socket = null;
        }
        this.connectionPromise = null;
        this.eventListeners.clear();
    }

    /*
    ** Socket Id
    */
    public async getSocketId(): Promise<string> {
        return new Promise((res, rej) => {
            this.send('get-socket-id').then(scss => {
                if(!scss) rej(new Error('Failed to send socket id request'));
            }).catch(rej);
            this.on("res-socket-id", (id: string) => {
                res(id);
            });
            return res;
        });
    }

    /*
    ** Getters
    */
    public get isConnected(): boolean {
        return this.socket?.readyState === WebSocket.OPEN;
    }

    public get readyState(): number {
        return this.socket?.readyState || WebSocket.CLOSED;
    }
}