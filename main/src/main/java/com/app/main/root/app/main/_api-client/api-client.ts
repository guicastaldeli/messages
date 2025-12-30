import { TimeStreamClient } from "./time-stream-client";
import { SessionServiceClient } from "./session-service-client";
import { AuthServiceClient } from "./auth-service-client";
import { UserServiceClient } from "./user-service-client";
import { SocketClientConnect } from "../socket-client-connect";

export class ApiClient {
    private baseUrl: string | undefined;
    private socketClient!: SocketClientConnect;

    private timeStream: TimeStreamClient;
    private sessionSerive: SessionServiceClient;
    private authService: AuthServiceClient;
    private userService: UserServiceClient;

    constructor(socketClient: SocketClientConnect) {
        this.getUrl();
        this.timeStream = new TimeStreamClient(this.baseUrl);
        this.sessionSerive = new SessionServiceClient(this.baseUrl);
        this.authService = new AuthServiceClient(this.baseUrl);
        this.userService = new UserServiceClient(this.baseUrl);
    }

    public getUrl(): string {
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