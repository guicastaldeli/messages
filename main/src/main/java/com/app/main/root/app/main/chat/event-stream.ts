interface StreamConfig {
    destination: string;
    payload: any;
    succssDestination: string;
    errDestination: string;
}

export class EventStream {
    private socketClientConnect: SocketClientConnect;
    private config: StreamConfig;
    private messsageHandlers: Map<string, Function[]> = new Map();
    private isComplete: boolean = false;
    private isStarted: boolean = false;

    constructor(socketClientConnect: SocketClientConnect, config: StreamConfig) {
        this.socketClientConnect = socketClientConnect;
        this.config = config; 
    }

    /**
     * Setup Event Handlers
     */
    private setupEventHandlers(): void {
        this.socketClientConnect.onDestination(this.config.succssDestination, (data: any) => {
            if(data.type === 'STREAM_COMPLETE') {
                this.isComplete = true;
                this.emit('complete', data);
                this.cleanup();
                return;
            }
        });
        this.socketClientConnect.onDestination(this.config.errDestination, (err: any) => {
            this.emit('error', err);
            this.cleanup();
        });
    }

    /**
     * On
     */
    public on(e: string, handler: Function): void {
        if(!this.messageHandlers.has(e)) {
            this.messageHandlers.set(e, []);
        }
        this.messageHandlers.get(e)!.push(handler);
    }

    /**
     * Off
     */
    public off(e: string, handler: Function): void {
        const handlers = this.messageHandlers.get(e);
        if(handlers) {
            const i = handlers.indexOf(handler);
            if(i > -1) handlers.splice(i, 1);
        }
    }

    /**
     * Emit
     */
    private emit(e: string, data: any): void {
        const handlers = this.messageHandlers.get(e);
        if(handlers) handlers.forEach(handler => handler(data));
    }

    /**
     * Start
     */
    public async start(): Promise<void> {
        if(this.isStarted) {
            console.warn('EventStream already started');
            return;
        }

        this.isStarted = true;
        this.setupEventHandlers();

        await this.socketClient.sendToDestination(
            this.config.destination,
            this.config.payload,
            this.config.succssDestination
        );
    }

    /**
     * Stop
     */
    public stop(): void {
        this.cleanup();
    }

    private cleanup(): void {
        this.socketClientConnect.offDestination(this.config.succssDestination);
        this.socketClientConnect.offDestination(this.config.errDestination);
        this.messageHandlers.clear();
        this.isStarted = false;
    }

    public get completed(): boolean {
        return this.isComplete;
    }

    public get started(): boolean {
        return this.isStarted;
    }
}