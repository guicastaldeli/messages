interface StreamConfig {
    destination: string;
    payload: any;
    succssDestination: string;
    errDestination: string;
}

export class EventStream {
    private socketClientConnect: SocketClientConnect;
    private messageService: MessageService;
    private fileService: FileService;

    private config: StreamConfig;
    private messageHandlers: Map<string, Function[]> = new Map();
    private isComplete: boolean = false;
    private isStarted: boolean = false;

    constructor(
        socketClientConnect: SocketClientConnect, 
        config: StreamConfig,
        messageService: MessageService,
        fileService: FileService
    ) {
        this.socketClientConnect = socketClientConnect;
        this.config = config; 
        this.messageService = messageService;
        this.fileService = fileService;
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
    
    /**
     * Setup Event Handlers
     */
    private setupEventHandlers(): void {
        this.socketClientConnect.onDestination(this.config.succssDestination, async (data: any) => {
            if(data.type === 'STREAM_COMPLETE') {
                this.isComplete = true;
                this.emit('complete', data);
                this.cleanup();
                return;
            }

            try {
                const processedData = await this.processData(data);
                this.emit(data.type.toLowerCase(), processedData);
            } catch(err) {
                console.error('Failed to process stream data:', err);
                this.emit('processing-error', { original: data, error: err });
            }
        });
        this.socketClientConnect.onDestination(this.config.errDestination, (err: any) => {
            this.emit('error', err);
            this.cleanup();
        });
    }

    /**
     * 
     * Process Data
     * 
     */
    private async processData(data: any): Promise<any> {
        if(data.type === 'MESSAGE_DATA' && data.message) {
            return await this.processMessageData(data);
        } else if(data.type === 'FILE_DATA' && data.file) {
            return await this.processFileData(data);
        } else if(data.type === 'CHAT_DATA' && data.chat) {
            return await this.processChatData(data);
        }
        return data;
    }

    private async processMessageData(data: any): Promise<any> {
        if(!this.messageServiceClient) {
            console.warn('No message service client available for decryption');
            return data;
        }

        try {
            const chatId = data.chatId || data.message.chatId;
            const decryptedMessage = await this.messageServiceClient.decryptMessage(
                chatId,
                data.message
            );
            
            return {
                ...data,
                message: decryptedMessage,
                decrypted: true
            }
        } catch(err) {
            console.error('Failed to decrypt message:', err);
            return {
                ...data,
                decryptionError: err.message,
                decrypted: false
            }
        }
    }

    private async processFileData(data: any): Promise<any> {
        if(!this.fileServiceClient) {
            console.warn('No file service client available for decryption');
            return data;
        }

        try {
            const chatId = data.chatId || data.file.chatId;
            const decryptedFile = await this.fileServiceClient.decryptFile(
                chatId,
                data.file
            );
            
            return {
                ...data,
                file: decryptedFile,
                decrypted: true
            }
        } catch(err) {
            console.error('Failed to decrypt file:', err);
            return {
                ...data,
                decryptionError: err.message,
                decrypted: false
            };
        }
    }

    private async processChatData(data: any): Promise<any> {
        return {
            ...data,
            processed: true
        };
    }
}