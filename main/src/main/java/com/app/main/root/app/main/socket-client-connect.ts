
export class SocketClientConnect {
    private static instance: SocketClientConnect;
    private socket: WebSocket | null = null;
    private eventListeners: Map<string, Function[]> = new Map();
    private reconnectAttemps = 0;
    private maxReconnectAttemps = 5;
    private connectionPromise: Promise<void> | null = null;
    private socketId: string | null = null;

    public static getInstance(): SocketClientConnect {
        if(!SocketClientConnect.instance) SocketClientConnect.instance = new SocketClientConnect;
        return SocketClientConnect.instance;
    }

    public connect(): Promise<void> {
        if(this.connectionPromise) return this.connectionPromise;

        this.connectionPromise = new Promise((res, rej) => {
            try {
                const protocol = window.location.protocol === 'http:' ? 'ws:' : 'wss:';
                const host = process.env.NEXT_PUBLIC_WS_HOST || window.location.hostname;
                const port = process.env.NEXT_PUBLIC_WS_PORT || '3001';
                const wsUrl = `${protocol}//${host}:${port}/ws-direct`;

                console.log('Connecting to WebSocket', wsUrl);
                this.socket = new WebSocket(wsUrl);

                this.socket.onopen = () => {
                    console.log('Connected to Java Websocket server');
                    this.reconnectAttemps = 0;
                    res();
                }
                this.socket.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);

                        if(message.event === 'connect') {
                            console.log('Received message:', message);
                            this.socketId = message.data;
                            res();
                            this.emit(message.event, message.data);
                        }
                    } catch(err) {
                        console.error('Error parsing WebSocket message:', err);
                    }
                }
                this.socket.onclose = (event) => {
                    console.log('WebSocket connection closed:', event.code, event.reason);
                    this.connectionPromise = null;
                    if(event.code !== 1000) this.handleReconnect();
                }
                this.socket.onerror = (err) => {
                    console.error('WebSocket error:', err);
                    this.connectionPromise = null;
                    rej(err);
                }
            } catch(err) {
                this.connectionPromise = null;
                rej(err);
            }
        });

        return this.connectionPromise;
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
    public on(event: string, callback: Function): void {
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
    public emit(event: string, data?: any): void {
        const listeners = this.eventListeners.get(event);
        console.log('Emitted', { event, data })
        if(listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch(err) {
                    console.error(`Error in event listener for ${event}:`, err);
                }
            });
        }
    }

    /*
    ** Send
    */
    public send(event: string, data?: any): void {
        if(this.socket && this.socket.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({ event, data });
            console.log('Sending message:', { event, data });
            this.socket.send(message);
        } else {
            console.error('WebSocket not connected. Cannot send message:', event);
        }
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
    public getSocketId(): string | null {
        return this.socketId;
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