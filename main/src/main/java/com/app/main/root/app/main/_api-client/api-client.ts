import { MessageServiceClient } from "./message-service-client";
import { TimeStreamClient } from "./time-stream-client";

export class ApiClient {
    private baseUrl: string;

    private timeStream: TimeStreamClient;
    private messageService: MessageServiceClient;

    constructor() {
        this.baseUrl = 
        process.env.JAVA_API_URL || 'http://localhost:3002'

        this.timeStream = new TimeStreamClient(this.baseUrl);
        this.messageService = new MessageServiceClient(this.baseUrl);
    }

    /*
    ** Time Stream
    */
    public async getTimeStream(): Promise<TimeStreamClient> {
        return this.timeStream;
    }

    /*
    ** Message Service
    */
    public async getMessageService(): Promise<MessageServiceClient> {
        return this.messageService;
    }  
} 