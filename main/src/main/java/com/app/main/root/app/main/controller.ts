import { SocketClientConnect } from "./socket-client-connect";
import { MessageManager } from "./_messages_config/message-manager";
import { DirectManager } from "./chat/direct/direct-manager";
import { GroupManager } from "./chat/group/group-manager";

export class Controller {
    private socketClient: SocketClientConnect;
    private messageManager: MessageManager;
    private dashboard!: any;
    private appEl: any;
    private uname: any;

    public directManager!: DirectManager;
    public groupManager!: GroupManager;

    constructor(
        socketClient: SocketClientConnect,
        messageManager: MessageManager,
        dashboard: any,
        appEl: any,
        uname: any,
    ) {
        this.socketClient = socketClient;
        this.messageManager = messageManager;
        this.dashboard = dashboard;
        this.appEl = appEl;
        this.uname = uname;
    }

    public setDashboard(dashboard: any): void {
        if(this.dashboard === dashboard) return;
        this.dashboard = dashboard;
        this.groupManager.dashboard = dashboard;
    }

    public init(): void {
        //Group Manager
        this.groupManager = new GroupManager(
            this.socketClient,
            this.messageManager,
            this.dashboard,
            this.appEl,
            this.uname
        );
    }
}