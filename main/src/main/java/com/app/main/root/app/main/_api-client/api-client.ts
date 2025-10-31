import { TimeStreamClient } from "./time-stream-client";
import { MessageServiceClient } from "./message-service-client";
import { SessionServiceClient } from "./session-service-client";
import { AuthServiceClient } from "./auth-service-client";
import { UserServiceClient } from "./user-service-client";

export class ApiClient {
    private baseUrl: string | undefined;

    private timeStream: TimeStreamClient;
    private sessionSerive: SessionServiceClient;
    private messageService: MessageServiceClient;
    private authService: AuthServiceClient;
    private userService: UserServiceClient;

    constructor() {
        this.getUrl();
        this.timeStream = new TimeStreamClient(this.baseUrl);
        this.sessionSerive = new SessionServiceClient(this.baseUrl);
        this.messageService = new MessageServiceClient(this.baseUrl);
        this.authService = new AuthServiceClient(this.baseUrl);
        this.userService = new UserServiceClient(this.baseUrl);
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
    ** Auth Service
    */
    public async getAuthService(): Promise<AuthServiceClient> {
        return this.authService;
    }

    /*
    ** User Service
    */
    public async getUserService(): Promise<UserServiceClient> {
        return this.userService;
    }
} 