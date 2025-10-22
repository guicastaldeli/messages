import { React, ReactDOMServer } from "next/dist/server/route-modules/app-page/vendored/ssr/entrypoints";
import { SocketClientConnect } from "../socket-client-connect";
import { ContentGetter } from "../../content-getter";
import { MessageTypes } from "./message-types";
import { Controller } from "../controller";
import { QueueManager } from "./queue-manager";

export class MessageManager {
    private queueManager: QueueManager;
    private contentGetter: ContentGetter;
    public socketClient: SocketClientConnect;
    private messageTypes: MessageTypes;
    public controller!: Controller;
    public dashboard: any;

    private uname: any;
    private appEl: HTMLDivElement | null = null;
    private socketId: string | null = null;
    private currentUserId: string | null = null;
    private joinHandled: boolean = false;

    private isSending: boolean = false;
    private sendQueue: Array<() => Promise<void>> = [];

    constructor(socketClient: SocketClientConnect) {
        this.contentGetter = new ContentGetter();
        this.socketClient = socketClient;
        this.messageTypes = new MessageTypes(this.contentGetter);
        this.queueManager = new QueueManager(socketClient);
    }

    private initController(): void {
        this.controller = new Controller(
            this.socketClient,
            this,
            this.dashboard,
            this.appEl,
            this.uname
        );
    }

    public async init(): Promise<void> {
        if(typeof document === 'undefined') return;
        this.appEl = document.querySelector<HTMLDivElement>('.app');
        this.setupMessageHandling();

        this.socketClient.on('connect', (id: string) => {
            this.socketId = id;
            this.currentUserId = id;
        });

        await this.socketClient.connect();
        await this.setupSubscriptions();
    }

    /*
    ** Setup Subscriptions
    */
    private async setupSubscriptions(): Promise<void> {
        await this.queueManager.subscribeToMessageType('DIRECT', this.handleChatMessage.bind(this));
        await this.queueManager.subscribeToMessageType('GROUP', this.handleChatMessage.bind(this));
        await this.queueManager.subscribeToMessageType('SYSTEM', this.handleSystemMessage.bind(this));
    }

    /* Handle Chat Message */
    private async handleChatMessage(data: any): Promise<void> {
        const client = await this.socketClient.getSocketId();

        const isSelfMessage = 
            data._metadata?.queue?.includes('self') ||
            data.senderId === this.socketId ||
            data.senderId === this.currentUserId ||
            data.senderId === client;
        const type = isSelfMessage ? 'self' : 'other';
        if(this.currentUserId === null) this.currentUserId = client;

        this.renderMessage(type, {
            username: data.username,
            content: data.content,
            messageId: data.messageId,
            timestamp: data.timestamp,
            type: 'MESSAGE',
            isOwnMessage: isSelfMessage,
            groupId: data.chatId
        });
    }

    /* Handle System Message */
    private handleSystemMessage(data: any): void {
        this.renderSystemMessage({
            content: data.content,
            type: 'SYSTEM_MESSAGE',
            timestamp: data.timestamp,
            isOwnMessage: false
        });
    }

    public handleJoin(): Promise<'dashboard'> {
        return new Promise(async (res, rej) => {
            if(!this.appEl || this.joinHandled) return rej('err');
            
            const usernameInput = this.appEl.querySelector<HTMLInputElement>('.join-screen #username');
            if(!usernameInput || !usernameInput.value.trim()) return rej(new Error('Username is required'));
            this.joinHandled = true;

            const data = {
                userId: await this.socketClient.getSocketId(),
                username: usernameInput.value.trim(),
                sessionId: await this.socketClient.getSocketId()
            }

            try {
                const sucss = await this.socketClient.sendToDestination(
                    '/app/new-user',
                    data,
                    '/topic/user'
                );
                if(!sucss) {
                    this.joinHandled = false;
                    return rej(new Error('Failed to send join request!'));
                }
                this.uname = usernameInput.value;
                this.initController();
                this.controller.init();
                res('dashboard');
            } catch(err) {
                this.joinHandled = false;
                rej(err);
            }
        });
    }

    /*
    ** Setup Message Handling
    */
    private setupMessageHandling(): void {
        if(!this.appEl) return;

        this.appEl.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if(target.id === 'send-message' || target.closest('#send-message')) {
                e.preventDefault();
                e.stopImmediatePropagation();
                this.queueMessageSend();
            }
        });
        this.appEl.addEventListener('keypress', (e) => {
            if(e.key === 'Enter' && (e.target as HTMLElement).id === 'message-input') {
                e.preventDefault();
                this.queueMessageSend();
            }
        });
    }

    /*
    ** Queue Message Send
    */
    private async queueMessageSend(): Promise<void> {
        if(this.isSending) {
            console.log('Message in progress');
            return;
        }
        this.sendQueue = [];
        await this.handleMessageSend();
    }

    public async handleMessageSend(): Promise<void> {
        if(this.isSending) return;
        this.isSending = true;

        try {
            if(!this.appEl) {
                this.isSending = false;
                return;
            }

            const msgInputEl = this.appEl.querySelector<HTMLInputElement>('.chat-screen #message-input');
            const senderId = await this.socketClient.getSocketId();
            if(!msgInputEl) {
                this.isSending = false;
                return;
            }

            const msgInput = msgInputEl.value.trim();
            if(!msgInput.length) {
                this.isSending = false;
                return;
            }
            msgInputEl.value = '';

            await this.send({
                senderId: senderId,
                username: this.uname,
                content: msgInput
            });

            msgInputEl.focus();
        } catch(err) {
            console.error(err);
        } finally {
            this.isSending = false;
        }
    }


    /*
    ** Send Message Method
    */
    private async send(data: any): Promise<void> {
        try {
            const success = await this.queueManager.sendWithRouting(
                data,
                'CHAT',
                {
                    routing: 'STANDARD',
                    priority: 'NORMAL'
                }
            );
            if(!success) throw new Error('Failed to send message');
        } catch(err) {
            console.error('Send message err', err);
            throw err;
        }
    }

    /* Render System Messages */
    private renderSystemMessage(type: any) {
        if(!this.appEl) return;

        let messageContainer = this.appEl.querySelector<HTMLDivElement>('.chat-screen .messages');
        if(!messageContainer) throw new Error('message container err');

        const content = this.contentGetter.__userEventMessageContent(
            this.messageTypes.content, 
            type
        );

        if(React.isValidElement(content)) {
            const render = ReactDOMServer.renderToStaticMarkup(content);
            messageContainer.insertAdjacentHTML('beforeend', render);
        }
    }

    /* Render Messages */
    private renderMessage(type: any, data: any) {
        if(!this.appEl) return;

        let messageContainer = this.appEl.querySelector<HTMLDivElement>('.chat-screen .messages');
        if(!messageContainer) throw new Error('message container err');

        const content = this.contentGetter.__messageContent(
            this.messageTypes.content, 
            type, 
            data
        );

        if(React.isValidElement(content)) {
            const render = ReactDOMServer.renderToStaticMarkup(content);
            messageContainer.insertAdjacentHTML('beforeend', render);
        }
    }
}