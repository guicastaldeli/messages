import { SocketClientConnect } from "../socket-client-connect";
import { ChatService } from "./chat-service";

interface StreamConfig {
    destination: string;
    payload: any;
    succssDestination: string;
    errDestination: string;
}

export class EventStream {
    private socketClientConnect: SocketClientConnect;
    private chatService: ChatService;

    private config: StreamConfig;
    private messageHandlers: Map<string, Function[]> = new Map();
    private isComplete: boolean = false;
    private isStarted: boolean = false;

    constructor(
        socketClientConnect: SocketClientConnect, 
        chatService: ChatService,
        config: StreamConfig
    ) {
        this.socketClientConnect = socketClientConnect;
        this.config = config; 
        this.chatService = chatService;
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

        await this.socketClientConnect.sendToDestination(
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
            if(!data || typeof data !== 'object') {
                console.warn('Invalid data received from socket:', data);
                this.emit('invalid-data', { data });
                return;
            }

            if(data.type === 'STREAM_COMPLETE') {
                this.isComplete = true;
                this.emit('complete', data);
                this.cleanup();
                return;
            }

            try {
                const processedData = await this.processData(data);
                
                const eventType = data.type && typeof data.type === 'string' 
                    ? data.type.toLowerCase() 
                    : 'unknown';
                    
                this.emit(eventType, processedData);
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
        if(!data || typeof data !== 'object') {
            console.warn('Invalid data structure in processData:', data);
            return { ...data, processingError: 'Invalid data structure' };
        }

        try {
            const type = (data.type || '').toLowerCase();
            
            switch (type) {
                case 'message_data':
                    if (data.message) {
                        return await this.processMessageData(data);
                    }
                    break;
                    
                case 'file_data':
                    if (data.file) {
                        return await this.processFileData(data);
                    }
                    break;
                    
                case 'chat_data':
                    return await this.processChatData(data);
                    
                default:
                    console.log('Unknown data type:', type, data);
                    return { ...data, processed: true, unknownType: type };
            }
            
            return data;
        } catch(error) {
            console.error('Error processing data:', error, data);
            return {
                ...data,
                processingError: error instanceof Error ? error.message : 'Unknown processing error',
                processed: false
            };
        }
    }

    private async processMessageData(data: any): Promise<any> {
        const messageService = await this.chatService.getMessageController().getMessageService();
        if(!messageService) {
            console.warn('No message service client available for decryption');
            return data;
        }

        try {
            const chatId = data.chatId || data.message.chatId;
            const decryptedMessage = await messageService.decryptMessage(
                chatId,
                data.message
            );
            
            return {
                ...data,
                message: decryptedMessage,
                decrypted: true
            }
        } catch(err: any) {
            console.error('Failed to decrypt message:', err);
            return {
                ...data,
                decryptionError: err.message,
                decrypted: false
            }
        }
    }

    private async processFileData(data: any): Promise<any> {
        const fileService = await this.chatService.getFileController().getFileService();
        if(!fileService) {
            console.warn('No file service client available for decryption');
            return data;
        }

        try {
            const chatId = data.chatId || data.file.chatId;
            const decryptedFile = await fileService.decryptFile(
                chatId,
                data.file
            );
            
            return {
                ...data,
                file: decryptedFile,
                decrypted: true
            }
        } catch(err: any) {
            console.error('Failed to decrypt file:', err);
            return {
                ...data,
                decryptionError: err.message,
                decrypted: false
            };
        }
    }

    private async processChatData(data: any): Promise<any> {
        const chatData = data.chat || data.chatData || data;
        
        if(!chatData.id && !chatData.chatId && !chatData.groupId) {
            console.warn('Invalid chat data - missing identifier:', chatData);
            return {
                ...data,
                chat: chatData,
                processed: true,
                validationWarning: 'Missing chat identifier'
            };
        }
        
        return {
            ...data,
            chat: chatData,
            processed: true
        };
    }
}