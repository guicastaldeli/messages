import { React, ReactDOMServer } from "next/dist/server/route-modules/app-page/vendored/ssr/entrypoints";
import { SocketClientConnect } from "../socket-client-connect";
import { ContentGetter } from "../../content-getter";
import { MessageTypes } from "./message-types";
import { Controller } from "../controller";
import { QueueManager } from "./queue-manager";
import { Analysis, MessageAnalyzerClient } from "./message-analyzer-client";
import { ChatRegistry, ChatType, Context } from "../chat/chat-registry";

export class MessageManager {
    private queueManager: QueueManager;
    private contentGetter: ContentGetter;
    public socketClient: SocketClientConnect;
    private messageTypes: MessageTypes;
    private messageAnalyzer: MessageAnalyzerClient;
    public controller!: Controller;
    public dashboard: any;
    private messageHandlers: Map<string, (data: any) => Promise<void>> = new Map();

    private chatRegistry: ChatRegistry = new ChatRegistry();
    private uname: any;
    private appEl: HTMLDivElement | null = null;
    private socketId: string | null = null;
    private currentUserId: string | null = null;
    private joinHandled: boolean = false;

    private isSending: boolean = false;
    private sendQueue: Array<() => Promise<void>> = [];

    constructor(
        socketClient: SocketClientConnect,
        messageAnalyzer: MessageAnalyzerClient
    ) {
        this.socketClient = socketClient;
        this.contentGetter = new ContentGetter();
        this.messageTypes = new MessageTypes(this.contentGetter);
        this.queueManager = new QueueManager(socketClient);
        this.messageAnalyzer = new MessageAnalyzerClient();
        this.setupHandlers();
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
    ** Setup Handlers
    */
    private setupHandlers(): void {
        this.messageHandlers.set('DIRECT', this.handleChatMessage.bind(this));
        this.messageHandlers.set('GROUP', this.handleChatMessage.bind(this));
       // this.messageHandlers.set('SYSTEM', this.handleSystemMessage.bind(this));
    }

    /*
    ** Setup Subscriptions
    */
    private async setupSubscriptions(): Promise<void> {
        const client = await this.socketClient.getSocketId();
        this.socketId = client;
        this.messageAnalyzer.init(client, this.currentUserId, this.uname);
        for(const [messageType, handler] of this.messageHandlers) {
            await this.queueManager.subscribeToMessageType(messageType, handler);
        }
    }

    /* SWITCH LATER TO JOIN CLASS :P */
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
    ** Set CurrentChat
    */
    public async setCurrentChat(
        chatId: string,
        chatType: ChatType,
        members?: string[]
    ): Promise<void> {
        let context: Context;

        if(chatId && members) {
            context = this.chatRegistry.getContext('GROUP', members);
            context.id = chatId;
        } else {
            context = this.chatRegistry.getContext('DIRECT', [this.socketId!]);
            context.id = chatId;
        }

        this.chatRegistry.setCurrentChat(context.id);
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
        await this.handleSendMessage();
    }

    /*
    ** Send Message Handler
    */
    public async handleSendMessage(): Promise<void> {
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

            const content = {
                content: msgInput,
                senderId: senderId,
                username: this.uname,
                timestamp: Date.now()
            };
            await this.sendMessage(content);

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
    private async sendMessage(content: any): Promise<boolean> {
        const client = this.socketId;
        const time = Date.now();
        const currentChat = this.chatRegistry.getCurrentChat();
        if(!client) return false;

        const data = {
            senderId: client,
            username: this.uname,
            content: content.content,
            messageId: content.messageId,
            chatId: currentChat?.id || content.chatId,
            targetUserId: currentChat?.type === 'DIRECT'
                ? currentChat.members.find(m => m !== client)
                : content.taregetUserId,
            timestamp: time,
            chatType: content.chatType
        }

        const analysis = this.messageAnalyzer.analyzeMessage(data);
        const type = analysis.messageType.split('_')[0];

        const analyzedData = {
            ...analysis.context,
            _metadata: {
                type: type,
                timestamp: time,
                routing: 'STANDARD',
                priority: analysis.priority
            }
        }

        return await this.queueManager.sendWithRouting(
            analyzedData,
            type,
            {
                priority: analysis.priority,
                metadata: analysis.metadata
            }
        )
    }

    /* Handle Chat Message */
    private async handleChatMessage(data: any): Promise<void> {
        const type = this.messageAnalyzer.detectMessageType(data);
        console.log(`Type: ${type}`);

        const analysis = this.messageAnalyzer.analyzeMessage(data);
        console.log(`Analysis type: ${analysis.messageType}`);
        
        await this.renderMessage(data, analysis);
    }

    /* Render Messages */
    private async renderMessage(data: any, analysis: Analysis): Promise<void> {
        if(!this.appEl) return;
        const container = this.appEl.querySelector<HTMLDivElement>('.chat-screen .messages');
        let content: React.ReactElement;

        if(analysis.direction === 'self') {
            content = this.contentGetter.__self({
                username: data.username || 'Unknown',
                content: data.content,
                timestamp: data.timestamp,
                messageId: data.messageId,
                type: analysis.messageType,
                priority: analysis.priority,
                isDirect: analysis.context.isDirect,
                isGroup: analysis.context.isGroup
            });
        } else {
            content = this.contentGetter.__other({
                username: data.username || 'Unknown',
                content: data.content,
                timestamp: data.timestamp,
                messageId: data.messageId,
                type: analysis.messageType,
                priority: analysis.priority,
                isDirect: analysis.context.isDirect,
                isGroup: analysis.context.isGroup
            });
        }

        const render = ReactDOMServer.renderToStaticMarkup(content);
        container?.insertAdjacentHTML('beforeend', render);
        this.appEl.innerHTML += render;
    }
}