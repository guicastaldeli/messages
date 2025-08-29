import io, { Socket } from 'socket.io-client';

export class SocketClient {
    private socket: typeof Socket | null = null;
    private eventListeners: Map<string, Function[]> = new Map();
    private url!: string;

    //Url
    private async getUrl(): Promise<string> {
        try {
            const port = process.env.PORT || 3001;
            const { protocol, hostname } = window.location;
            this.url = `${protocol}//${hostname}:${port}`;
        } catch(err) {
            console.log(err);
        }

        return this.url;
    }

    public async connect(): Promise<void> {
        try {
            const url = await this.getUrl();
            this.socket = io(url, { transports: ['websocket', 'polling'] });
            this.setupSockets();
        } catch(err) {
            console.log(err);
        }
    }

    private setupSockets(): void {
        if(!this.socket) return;

        //Connect
        this.socket.on('connect', () => {
            console.log('connected to server');
            this.emitEvent('connect');
        });
        //Update
        this.socket.on('update', (data: any) => {
            console.log('update received', data);
            this.emitEvent('update', data);
        });
        //Chat
        this.socket.on('chat', (data: any) => {
            console.log('chat received', data);
            this.emitEvent('chat', data);
        });
        //Disconnected
        this.socket.on('disconnect', (data: any) => {
            console.log('disconnected from server', data);
            this.emitEvent('disconecct');
        });
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

    //Emitters
    public emitEvent(event: string, data?: any): void {
        const listeners = this.eventListeners.get(event);
        if(listeners) listeners.forEach(callback => callback(data));
    }

    public emitNewUser(username: string): void {
        if(!this.socket) return;
        this.socket.emit('new-user', username);
    }

    public emitExitUser(username: string): void {
        if(!this.socket) return;
        this.socket.emit('exit-user', username);
    }

    public emitNewMessage(message: string): void {
        if(!this.socket) return;
        this.socket.emit('chat', message);
    }
}