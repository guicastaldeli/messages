import { React, ReactDOMServer } from "next/dist/server/route-modules/app-page/vendored/ssr/entrypoints";
import { SocketClientConnect } from "../socket-client-connect";
import { QueueManager } from "./queue-manager";
import { Analysis, MessageAnalyzerClient } from "./message-analyzer-client";
import { ChatRegistry, ChatType, Context } from "../chat/chat-registry";
import { ChatManager } from "../chat/chat-manager";
import { ApiClient } from "../_api-client/api-client";
import { MessageHandler, RegisteredMessageHandlers } from "./message-handler";
import { MessageComponentGetter } from "./message-component";
import { UserColorGenerator } from "@/app/_utils/UserColorGenerator";

export class MessageManager {
    private queueManager: QueueManager;
    public socketClient: SocketClientConnect;
    private chatManager!: ChatManager;
    private messageAnalyzer: MessageAnalyzerClient;
    private messageComponent: MessageComponentGetter;
    private apiClient: ApiClient;
    public dashboard: any;
    
    private registeredMessageHandlers: RegisteredMessageHandlers;
    private currentHandler: MessageHandler | null = null;
    private messageHandlers: Map<string, (data: any) => Promise<void>> = new Map();
    private lastMessageId: string | null = null;
    private lastMessageIds: Map<string, string> = new Map();
    private lastSystemMessageKeys: Set<string> = new Set();

    private chatRegistry: ChatRegistry = new ChatRegistry();
    private uname: any;
    private appEl: HTMLDivElement | null = null;
    private socketId: string | null = null;
    private currentUserId: string | null = null;
    private joinHandled: boolean = false;

    private isSending: boolean = false;
    private sendQueue: Array<() => Promise<void>> = [];

    constructor(socketClient: SocketClientConnect, apiClient: ApiClient) {
        this.socketClient = socketClient;
        this.apiClient = apiClient;
        this.queueManager = new QueueManager(socketClient);
        this.messageAnalyzer = new MessageAnalyzerClient();
        this.messageComponent = new MessageComponentGetter();
        this.registeredMessageHandlers = new RegisteredMessageHandlers();
        this.registeredMessageHandlers.register();
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

    private getHandlerByType(chatType: ChatType): MessageHandler {
        const handler = this.registeredMessageHandlers.messageHandlers
            .find(h => h.canHandle(chatType));
        if(!handler) throw new Error(`No message handler for chat type: ${chatType}`);
        return handler;
    }
    
    /*
    ** Setup Subscriptions
    */
    private async setupSubscriptions(): Promise<void> {
        const client = await this.socketClient.getSocketId();
        this.socketId = client;
        this.messageAnalyzer.init(client, this.currentUserId, this.uname);
        await this.updateSubscription('CHAT', undefined, 'CHAT');
    }

    /*
    ** Update Subscription
    */
    private async updateSubscription(type?: string, chatId?: string, handlerType?: ChatType): Promise<void> {
        if(this.currentHandler && this.chatRegistry.getCurrentChat()) {
            const currentChatId = this.chatRegistry.getCurrentChat()!.id;
            const currentPattern = this.currentHandler.getSubscriptionPattern(currentChatId);
            await this.queueManager.unsubscribe(currentPattern);
        }

        this.currentHandler = this.getHandlerByType(handlerType!);
        const pattern = this.currentHandler.getSubscriptionPattern(chatId || 'default');
        await this.queueManager.subscribe(pattern, this.handleChatMessage.bind(this));
    }

    /* SWITCH LATER TO JOIN CLASS :P */
    public setUsername(username: string): void {
        this.uname = username;
    }
    public handleJoin(): Promise<'dashboard'> {
        return new Promise(async (res, rej) => {
            if(!this.appEl || this.joinHandled) return rej('err');
            
            const usernameInput = this.appEl.querySelector<HTMLInputElement>('.join-screen #username');
            this.joinHandled = true;

            const data = {
                userId: await this.socketClient.getSocketId(),
                username: usernameInput!.value.trim(),
                sessionId: await this.socketClient.getSocketId()
            }
            console.log(this.socketId)

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
                this.uname = usernameInput!.value;
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
        await this.handleSendMessage();
    }

    /*
    ** Set CurrentChat
    */
    public async setCurrentChat(
        chatId: string,
        chatType: ChatType,
        members?: string[]
    ): Promise<void> {
        const context = this.chatRegistry.getContext(chatType, members || []);
        context.id = chatId;
        context.type = chatType;
        this.chatRegistry.setCurrentChat(context);
        const type = await this.getMetadataType(context);
        await this.updateSubscription(type, chatId, chatType);
    }

    /*
    ** Metadata Type
    */
    private async getMetadataType(context: Context): Promise<string> {
        const initData = {
            senderId: this.socketClient,
            username: this.uname,
            content: 'content',
            chatId: context.id,
            chatType: context.type,
            timestamp: Date.now()
        }

        const analysis = this.messageAnalyzer.analyzeMessage(initData);
        const type = analysis.metadata.type || analysis.messageType.split('_')[0];
        console.log(`Metadata type: ${type}`);
        return type;
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
        this.currentUserId = client;
        const time = Date.now();
        const currentChat = this.chatRegistry.getCurrentChat();
        const isGroupChat = currentChat?.type === 'GROUP';
        const chatId = currentChat?.id;
        if(!chatId) {
            console.error('No chatId found');
            return false;
        }
        if(!client) return false;

        const data = {
            senderId: this.currentUserId,
            senderSessionId: this.socketId,
            username: this.uname,
            content: content.content,
            messageId: content.messageId,
            targetUserId: isGroupChat ? undefined : currentChat?.members.find(m => m != client),
            groupId: isGroupChat ? currentChat?.id : undefined,
            chatId: chatId,
            timestamp: time,
            chatType: content.chatType || currentChat?.type || isGroupChat ? 'GROUP' : 'DIRECT',
            type: 'CHAT',
        }

        const analysis = this.messageAnalyzer.analyzeMessage(data);
        const metaType = analysis.messageType.split('_')[0];
        const analyzedData = {
            ...analysis.context,
            _metadata: {
                type: metaType,
                timestamp: time,
                routing: 'STANDARD',
                priority: analysis.priority,
                senderSessionId: this.socketId,
            },
            _perspective: {
                senderSessionId: this.socketId,
                direction: analysis.direction,
                messageType: analysis.messageType,
                isCurrentUser: analysis.direction,
                isDirect: analysis.context.isDirect,
                isGroup: analysis.context.isGroup,
                isSystem: analysis.context.isSystem
            }
        }

        const res = await this.queueManager.sendWithRouting(
            analyzedData,
            metaType,
            {
                priority: analysis.priority,
                metadata: analysis.metadata
            }
        );
        if(res) {
            try {
                (await this.apiClient.getMessageService()).saveMessages({
                    messageId: analyzedData.messageId,
                    content: analyzedData.content,
                    senderId: analyzedData.senderId,
                    username: analyzedData.username,
                    chatId: analyzedData.chatId,
                    messageType: isGroupChat ? 'GROUP' : 'DIRECT',
                    direction: 'SENT'
                });
                this.chatManager.setLastMessage(
                    analyzedData.chatId,
                    analyzedData.messageId,
                    analyzedData.content,
                    analyzedData.senderId,
                    analyzedData.isSystem
                )
                console.log('Message saved on server! :)');
            } catch(err) {
                console.error('Failed to save message :(', err);
            }
        }
        return res;
    }

    /* Handle Chat Message */
    private async handleChatMessage(data: any): Promise<void> {
        const analysis = this.messageAnalyzer.getPerspective().analyzeWithPerspective(data);
        const messageType = data.type || data.routingMetadata?.messageType || data.routingMetadata?.type;
        const isSystemMessage = messageType.includes('SYSTEM');

        if(isSystemMessage) {
            const systemKey = `${data.event}_${data.content}_${data.timestamp}`;
            if(this.lastSystemMessageKeys.has(systemKey)) return;
            this.lastSystemMessageKeys.add(systemKey);
            await this.renderMessage(data, analysis);
            this.chatManager.setLastMessage(
                data.chatId,
                data.messageId,
                data.content,
                data.username,
                data.isSystem
            );
            return;
        }

        const lastMessageId = this.lastMessageIds.get(messageType);
        if(data.messageId === lastMessageId) return;

        this.lastMessageIds.set(messageType, data.messageId);
        const perspective = data._perspective;
        const direction = perspective?.direction || analysis.direction;
        await this.renderMessage(data, { ...analysis, direction });
        this.chatManager.setLastMessage(
            data.chatId,
            data.messageId,
            data.content,
            data.username,
            data.isSystem
        );
    }

    /* Render Messages */
    private async renderMessage(data: any, analysis: Analysis): Promise<void> {
        if(!this.appEl) return;
        const container = this.appEl.querySelector<HTMLDivElement>('.chat-screen .messages');
        const perspective = data._perspective || analysis.perspective;

        let userColor = null;
        const currentChat = this.chatRegistry.getCurrentChat();
        if(currentChat?.type === 'GROUP' && analysis.direction === 'other') {
            userColor = UserColorGenerator.getUserColorForGroup(
                currentChat.id,
                data.senderId || data.userId || this.currentUserId
            );
        }

        this.messageComponent.setCurrentUserId(this.currentUserId!);
        const messageProps = {
            username: perspective.showUsername,
            userId: this.currentUserId,
            content: data.content,
            timestamp: data.timestamp,
            messageId: data.messageId,
            type: analysis.messageType,
            priority: analysis.priority,
            isDirect: analysis.context.isDirect,
            isGroup: analysis.context.isGroup,
            isSystem: analysis.context.isSystem,
            perspective: perspective,
            direction: analysis.direction,
            userColor: userColor?.value,
            chatType: currentChat?.type,
        };

        const content = this.messageComponent.__message(messageProps);
        const render = ReactDOMServer.renderToStaticMarkup(content!);
        container?.insertAdjacentHTML('beforeend', render);
    }

    /*
    ** Render History
    */
    public async renderHistory(data: any): Promise<void> {
        if(!this.appEl) return;
        
        const isSystemMessage = 
            data.messageType === 'SYSTEM' ||
            data.type === 'SYSTEM' ||
            data.isSystem === true;
        if(isSystemMessage) {
            await this.renderMessage({
                ...data,
                isSystem: true,
                direction: 'other'
            }, {
                direction: 'other',
                messageType: data.messageType || 'SYSTEM',
                priority: 'NORMAL',
                metadata: {},
                context: {
                    isDirect: false,
                    isGroup: true,
                    isSystem: true
                },
                perspective: {
                    showUsername: false
                }
            } as unknown as Analysis);
            return;
        }

        const perspective = this.messageAnalyzer.getPerspective().calculateClientPerspective(data);
        const analysis = this.messageAnalyzer.getPerspective().analyzeWithPerspective({
            ...data,
            _perspective: perspective
        });
        await this.renderMessage(data, analysis);
    }

    /*
    ** Set Chat Manager
    */
    public setChatManager(instance: ChatManager): void {
        this.chatManager = instance;
    }
}