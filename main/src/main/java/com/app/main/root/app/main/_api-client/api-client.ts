import { AuthServiceClient } from "./auth-service-client";
import { MessageServiceClient } from "./message-service-client";
import { SessionServiceClient } from "./session-service-client";
import { TimeStreamClient } from "./time-stream-client";

export class ApiClient {
    private baseUrl: string | undefined;

    private timeStream: TimeStreamClient;
    private sessionSerive: SessionServiceClient;
    private messageService: MessageServiceClient;
    private authService: AuthServiceClient;

    constructor() {
        this.getUrl();
        this.timeStream = new TimeStreamClient(this.baseUrl);
        this.sessionSerive = new SessionServiceClient(this.baseUrl);
        this.messageService = new MessageServiceClient(this.baseUrl);
        this.authService = new AuthServiceClient(this.baseUrl);
    }

    private getUrl(): string {
        this.baseUrl = process.env.NEXT_PUBLIC_API_URL;
        if(!this.baseUrl) throw new Error('URL err');
        return this.baseUrl;
    }

    /*
    ** Time Stream
    */
    public async getTimeStream(): Promise<TimeStreamClient> {
        return this.timeStream;
    }

    /*
    ** Session Service
    */
    public async getSessionService(): Promise<SessionServiceClient> {
        return this.sessionSerive;
    }

    /*
    ** Message Service
    */
    public async getMessageService(): Promise<MessageServiceClient> {
        return this.messageService;
    }

    /*
    ** Message Service
    */
    public async getAuthSerice(): Promise<AuthServiceClient> {
        return this.authService;
    }
} 