import io, { Socket } from 'socket.io-client';
import { SocketEmitter } from './socket-emitter';

export class SocketClient {
    private static instance: SocketClient;
    public socket: typeof Socket | null = null;
    public socketEmitter!: SocketEmitter;
    private eventListeners: Map<string, Function[]> = new Map();
    private url!: string;
    private socketId: string | null = null;

    private isConnecting: boolean = false;
    private isConnected: boolean = false;

    public static getInstance(): SocketClient {
        if(!SocketClient.instance) SocketClient.instance = new SocketClient();
        return SocketClient.instance;
    }

    //Url
    private async getUrl(): Promise<string> {
        try {
            const port = process.env.PORT || 3001;
            if(typeof window !== 'undefined' && window.location) {
                const { protocol, hostname } = window.location;
                this.url = `${protocol}//${hostname}:${port}`;
            }
        } catch(err) {
            console.log(err);
        }

        return this.url;
    }

    public async connect(): Promise<void> {
        if(this.isConnecting || this.isConnected) return;
        this.isConnecting = true;

        try {
            const url = await this.getUrl();
            if(!this.socket) {
                this.socket = io(url, { transports: ['websocket', 'polling'] });
                this.socketEmitter = new SocketEmitter(this.socket);
                this.socketEmitter.registerAllEvents(this.emitEvent.bind(this));

                this.socket.on('connect', () => {
                    this.socketId = this.socket!.id;
                    this.isConnected = true;
                    this.isConnecting = false;
                    this.emitEvent('connect', this.socketId);
                });
            }
        } catch(err) {
            console.log(err);
            throw new Error('err');
        }
    }

    public on(event: string, callback: Function): void {
        if(!this.eventListeners.has(event)) this.eventListeners.set(event, []);
        this.eventListeners.get(event)!.push(callback);
    }

    public off(event: string, callback: Function): void {
        const listeners = this.eventListeners.get(event);
        if(listeners) {
            const i = listeners.indexOf(callback);
            if(i > -1) listeners.splice(i, 1);
        }
    }

    public emitEvent(event: string, data?: any): void {
        const listeners = this.eventListeners.get(event);
        if(listeners) listeners.forEach(callback => callback(data));
    }

    public getSocketId(): string | null {
        return this.socketId;
    }
}