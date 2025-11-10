import ReactDOM from 'react-dom/client';
import { SocketClientConnect } from "../socket-client-connect";
import { QueueManager } from "./queue-manager";
import { MessageAnalyzerClient } from "./message-analyzer-client";
import { ChatRegistry, ChatType, Context } from "../chat/chat-registry";
import { ChatManager } from "../chat/chat-manager";
import { ApiClient } from "../_api-client/api-client";
import { MessageHandler, RegisteredMessageHandlers } from "./message-handler";
import { MessageComponentGetter } from "./_message-component";
import { CacheServiceClient } from "@/app/_cache/cache-service-client";
import { MessageElementRenderer } from "./message-element-renderer";
import { ChunkRenderer } from "./chunk-renderer";

export class MessageManager {
    private queueManager: QueueManager;
    public socketClient: SocketClientConnect;
    private chatManager!: ChatManager;
    public cacheService: CacheServiceClient;
    private messageAnalyzer: MessageAnalyzerClient;
    public messageComponent: MessageComponentGetter;
    private messageElementRenderer: MessageElementRenderer;
    private chunkRenderer: ChunkRenderer;
    private apiClient: ApiClient;
    public dashboard: any;
    
    private registeredMessageHandlers: RegisteredMessageHandlers;
    private currentHandler: MessageHandler | null = null;
    private messageHandlers: Map<string, (data: any) => Promise<void>> = new Map();
    private lastMessageId: string | null = null;
    private lastMessageIds: Map<string, string> = new Map();
    private lastSystemMessageKeys: Set<string> = new Set();

    public chatRegistry: ChatRegistry;
    public appEl: HTMLDivElement | null = null;
    private joinHandled: boolean = false;
    private socketId!: string;
    public userId!: string;
    public username!: string;

    private isSending: boolean = false;
    private sendQueue: Array<() => Promise<void>> = [];

    public currentChatId: string | null = null;
    public container: HTMLDivElement | null = null;
    public messageRoots: Map<string, ReactDOM.Root> = new Map();
    public currentPage: number = 0;
    public isLoadingHistory: boolean = false;
    public scrollHandler: ((e: Event) => void) | null = null;

    constructor(
        socketClient: SocketClientConnect, 
        apiClient: ApiClient, 
        cacheService: CacheServiceClient
    ) {
        this.socketClient = socketClient;
        this.apiClient = apiClient;
        this.queueManager = new QueueManager(socketClient);
        this.messageAnalyzer = new MessageAnalyzerClient();
        this.messageComponent = new MessageComponentGetter();
        this.registeredMessageHandlers = new RegisteredMessageHandlers();
        this.registeredMessageHandlers.register();
        this.chatRegistry = new ChatRegistry();
        this.cacheService = cacheService;
        this.messageElementRenderer = new MessageElementRenderer(this);
        this.chunkRenderer = new ChunkRenderer(this);
    }

    public async init(): Promise<void> {
        if(typeof document === 'undefined') return;
        this.appEl = document.querySelector<HTMLDivElement>('.app');
        this.messageElementRenderer.setApp(this.appEl!);
        this.setupMessageHandling();
        await this.socketClient.connect();
    }

    public async getUserData(sessionId: string, userId: string, username: string): Promise<void> {
        this.socketId = sessionId;
        this.userId = userId;
        this.username = username;
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
        this.messageAnalyzer.init(this.socketId, this.userId, this.username);
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

    public setUsername(username: string): void {
        this.username = username;
    }

    /* SWITCH LATER */
    public handleJoin(
        sessionId: string, 
        userId: string, 
        username: string
    ): Promise<'dashboard'> {
        return new Promise(async (res, rej) => {
            if (!this.appEl || this.joinHandled) {
                return rej('err');
            }

            this.joinHandled = true;

            const data = {
                sessionId: sessionId,
                userId: userId,
                username: username
            };

            try {
                const success = await this.socketClient.sendToDestination(
                    '/app/new-user',
                    data,
                    '/topic/user'
                );
                if (!success) {
                    this.joinHandled = false;
                    return rej(new Error('Failed to send join request!'));
                }
                res('dashboard');
            } catch (err) {
                this.joinHandled = false;
                rej(err);
            }
        });
    }

    /*
    ** Setup Message Handling
    */
    public setupMessageHandling(): void {
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
    ** Set Current Chat
    */
    public async setCurrentChat(
        chatId: string,
        chatType: ChatType,
        members?: string[]
    ): Promise<void> {
        const context = this.chatRegistry.getContext(chatType, members || [], chatId);
        context.id = chatId;
        context.type = chatType;
        this.chatRegistry.setCurrentChat(context);

        const type = await this.getMetadataType(context);
        await this.updateSubscription(type, chatId, chatType);
        this.currentChatId = chatId;
        this.currentPage = 0;
        this.chunkRenderer.reset();
        
        this.messageRoots.forEach(root => root.unmount());
        this.messageRoots.clear();
        this.container = null;

        if(this.scrollHandler) {
            const container = await this.getContainer();
            if(container) {
                container.removeEventListener('scroll', this.scrollHandler);
            }
            this.scrollHandler = null;
        }

        const cacheData = this.cacheService.getCacheData(chatId);
        if(cacheData && cacheData.messages.size > 0) {
            await this.chunkRenderer.loadCachedPages(chatId);
            await this.chunkRenderer.setupScrollHandler();
            
            const container = await this.getContainer();
            if(container) {
                setTimeout(() => {
                    container.scrollTop = container.scrollHeight;
                }, 100);
            }
        } else {
            this.loadHistory(chatId, 0);
            await this.chunkRenderer.setupScrollHandler();
        }
    }

    /*
    ** Metadata Type
    */
    private async getMetadataType(context: Context): Promise<string> {
        const initData = {
            senderId: this.socketClient,
            username: this.username,
            content: 'content',
            chatId: context.id,
            chatType: context.type,
            timestamp: Date.now()
        }

        const analysis = this.messageAnalyzer.analyzeMessage(initData);
        const type = analysis.metadata.type || analysis.messageType.split('_')[0];
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
                username: this.username,
                timestamp: Date.now()
            };

            console.log('message:', content);
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
        const time = Date.now();
        const currentChat = this.chatRegistry.getCurrentChat();
        const chatId = currentChat?.id || currentChat?.chatId;
        if(!chatId) {
            console.error('No chatId found');
            return false;
        }
        if(!this.socketId) return false;

        const isGroupChat = chatId.startsWith('group_');
        const isDirectChat = chatId.startsWith('direct_');
        const chatType = isGroupChat ? 'GROUP' : (isDirectChat ? 'DIRECT' : 'CHAT');

        const data = {
            senderId: this.userId,
            senderSessionId: this.socketId,
            username: this.username,
            content: content.content,
            messageId: `msg_${time}_${Math.random().toString(36).substr(2, 9)}`,
            targetUserId: isGroupChat ? undefined : currentChat?.members.find(m => m != this.socketId),
            groupId: isGroupChat ? currentChat?.id : undefined,
            chatId: chatId,
            timestamp: time,
            chatType: content.chatType || chatType,
            type: chatType,
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
            metaType || chatType.toLowerCase(),
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
                    analyzedData.userId,
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

    /*
    ** Handle Chat Message
    */
    private async handleChatMessage(data: any): Promise<void> {
        const analysis = this.messageAnalyzer.getPerspective().analyzeWithPerspective(data);
        const messageType = data.type || data.routingMetadata?.messageType || data.routingMetadata?.type;
        const isSystemMessage = messageType.includes('SYSTEM');

        if(isSystemMessage) {
            const systemKey = `${data.event}_${data.content}_${data.timestamp}`;
            if(this.lastSystemMessageKeys.has(systemKey)) return;
            this.lastSystemMessageKeys.add(systemKey);
            await this.messageElementRenderer.setMessage(data, analysis);
            this.chatManager.setLastMessage(
                data.chatId,
                data.userId,
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
        await this.messageElementRenderer.setMessage(data, { ...analysis, direction });
        this.chatManager.setLastMessage(
            data.chatId,
            data.userId,
            data.messageId,
            data.content,
            data.username,
            data.isSystem
        );
    }

    /*
    ** Get Container
    */
    public async getContainer(): Promise<HTMLDivElement | null> {
        if (this.container) return this.container;
        
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50;

            const checkContainer = () => {
                this.container = this.appEl!.querySelector<HTMLDivElement>('.chat-screen .messages');
                if(this.container) {
                    resolve(this.container);
                } else {
                    attempts++;
                    if(attempts >= maxAttempts) {
                        resolve(null);
                        return;
                    }
                    setTimeout(checkContainer, 100);
                }
            };
            checkContainer();
        });
    }

    /*
    ** Load History
    */
    public async loadHistory(chatId: string, page: number = 0): Promise<void> {
        if(this.isLoadingHistory) return;
        this.isLoadingHistory = true;

        try {
            const messageService = await this.apiClient.getMessageService();
            const response = await messageService.getMessagesByChatId(chatId, page);

            if(response.messages && response.messages.length > 0) {
                this.cacheService.addMessagesPage(chatId, response.messages, page);
                const startIndex = page * 20;
                const endIndex = startIndex + response.messages.length - 1;
                const newMessages = this.cacheService.getMessagesInRange(
                    chatId,
                    startIndex,
                    endIndex
                );
                await this.messageElementRenderer.renderHistory(newMessages);
                if(page > this.currentPage) {
                    this.currentPage = page;
                }
            }
        } catch(err) {
            console.error(`Failed to laod history for page ${page}:`, err);
        } finally {
            this.isLoadingHistory = false;
        }
    }

    public cleanupCurrentChat(): void {
        this.messageRoots.forEach(root => root.unmount());
        this.messageRoots.clear();
        this.currentChatId = null;
        this.container = null;
    }

    /*
    ** Set Chat Manager
    */
    public setChatManager(instance: ChatManager): void {
        this.chatManager = instance;
    }

    /*
    ** Get Cache Service
    */
    public getCacheService(): CacheServiceClient {
        return this.cacheService;
    }

    /*
    ** Get Message Element Renderer
    */
    public getMessageElementRenderer(): MessageElementRenderer {
        return this.messageElementRenderer;
    }

    /*
    ** Get Chunk Renderer
    */
    public getChunkRenderer(): ChunkRenderer {
        return this.chunkRenderer;
    }

    /*
    ** Get Analyzer
    */
    public getAnalyzer(): MessageAnalyzerClient {
        return this.messageAnalyzer;
    }

    /*
    ** Get Api Client
    */
    public getApiClient(): ApiClient {
        return this.apiClient;
    }
}