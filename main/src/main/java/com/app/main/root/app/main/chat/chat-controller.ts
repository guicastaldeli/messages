import ReactDOM from 'react-dom/client';
import { SocketClientConnect } from "../socket-client-connect";
import { QueueManager } from "./queue-manager";
import { MessageAnalyzerClient } from "./messages/message-analyzer-client";
import { ChatRegistry, ChatType, Context } from "../chat/chat-registry";
import { ChatManager } from "../chat/chat-manager";
import { ApiClientController } from "../_api-client/api-client-controller";
import { MessageHandler, RegisteredMessageHandlers } from "./messages/message-handler";
import { MessageComponentGetter } from "./messages/message-item";
import { MessageElementRenderer } from "./messages/message-element-renderer";
import { ChunkRenderer } from "./chunk-renderer";
import { ChatStateManager } from '../chat/chat-state-manager';
import { ChatService } from './chat-service';
import { Item } from './file/file-item';
import { SessionManager } from '../_session/session-manager';

export class ChatController {
    private queueManager: QueueManager;
    public socketClient: SocketClientConnect;
    private chatManager!: ChatManager;
    public chatService: ChatService;
    private messageAnalyzer: MessageAnalyzerClient;
    public messageComponent: MessageComponentGetter;
    private messageElementRenderer: MessageElementRenderer;
    private chunkRenderer: ChunkRenderer;
    private chatStateManager = ChatStateManager.getIntance();
    private apiClientController: ApiClientController;
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
        apiClientController: ApiClientController, 
        chatService: ChatService
    ) {
        this.socketClient = socketClient;
        this.apiClientController = apiClientController;
        this.queueManager = new QueueManager(socketClient);
        this.messageAnalyzer = new MessageAnalyzerClient();
        this.messageComponent = new MessageComponentGetter();
        this.registeredMessageHandlers = new RegisteredMessageHandlers();
        this.registeredMessageHandlers.register();
        this.chatRegistry = new ChatRegistry();
        this.chatService = chatService;
        this.messageElementRenderer = new MessageElementRenderer(this);
        this.chunkRenderer = new ChunkRenderer(chatService, this);
    }

    public async init(): Promise<void> {
        if(typeof document === 'undefined') return;
        this.appEl = document.querySelector<HTMLDivElement>('.app');
        this.messageElementRenderer.setApp(this.appEl!);
        this.setupMessageHandling();
        await this.socketClient.connect();
    }

    public async getChatData(
        chatId: string,
        userId: string,
        page: number = 0
    ): Promise<{ messages: any[], files: any[], fromCache: boolean }> {
        return this.chatService.getData(chatId, userId, page);
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

    /**
     * Setup Subscriptions
     */
    private async setupSubscriptions(): Promise<void> {
        this.messageAnalyzer.init(this.socketId, this.userId, this.username);
        await this.updateSubscription('CHAT', undefined, 'CHAT');
    }

    /**
     * Update Subscription
     */
    private async updateSubscription(
        type?: string, 
        chatId?: string, 
        handlerType?: ChatType
    ): Promise<void> {
        const targetHandler = this.getHandlerByType(handlerType!);
        const targetPattern = targetHandler.getSubscriptionPattern(chatId || 'default');
        
        const currentChat = this.chatRegistry.getCurrentChat();
        const currentPattern = this.currentHandler?.getSubscriptionPattern(currentChat?.id || 'default') || '';
        if(this.currentHandler && currentPattern && currentPattern === targetPattern) {
            return;
        }
        if(this.currentHandler && currentPattern && currentPattern !== targetPattern) {
            await this.queueManager.unsubscribe(currentPattern);
        }
        
        this.currentHandler = targetHandler;
        await this.queueManager.subscribe(targetPattern, this.handleChatMessage.bind(this));
    }


    public setUsername(username: string): void {
        this.username = username;
    }

    public async renderAllCachedMessages(chatId: string): Promise<void> {
        const cacheData = await this.chatService.getCachedData(chatId);
        if(!cacheData) {
            console.log(`No cache data found for chat ${chatId}`);
            return;
        }

        const cacheService = await this.chatService.getCacheServiceClient();
        cacheService.validateCache(chatId);

        const container = await this.getContainer();
        if(!container) {
            console.error('Container not found');
            return;
        }

        const existingMessageIds = new Set<string>();
        const orphanedMessageIds: string[] = [];
        
        this.messageRoots.forEach((messageId: any) => {
            const element = container.querySelector(`[data-message-id="${messageId}"]`);
            if(element) {
                existingMessageIds.add(messageId);
            } else {
                orphanedMessageIds.push(messageId);
            }
        });

        if(orphanedMessageIds.length > 0) {
            orphanedMessageIds.forEach(messageId => {
                const root = this.messageRoots.get(messageId);
                if(root) {
                    try {
                        root.unmount();
                    } catch (error) {
                        console.error(`Failed to unmount orphaned root ${messageId}:`, error);
                    }
                    this.messageRoots.delete(messageId);
                }
            });
        }

        const allCachedMessages = Array.from(cacheData.messages.values() as any[])
            .sort((a, b) => {
                const timeA = a.timestamp || a.createdAt || 0;
                const timeB = b.timestamp || b.createdAt || 0;
                return timeA - timeB;
            });

        const cachedFiles = Array.from(cacheData.files.values() as any[]);
        const fileMessages = cachedFiles.map(file => ({
            type: 'file',
            fileData: {
                ...file,
                originalFileName: file.originalFileName || file.name,
                mimeType: file.mimeType || file.contentType,
                fileSize: file.fileSize || file.size,
                fileType: file.fileSize || 'other'
            },
            messageId: `file_${file.fileId || file.id}`,
            id: `file_${file.fileId || file.id}`,
            content: `Shared file: ${file.originalFileName || file.name}`,
            timestamp: file.uploadedAt ? new Date(file.uploadedAt).getTime() : Date.now(),
            userId: file.uploaded_by || file.userId,
            chatId: file.chat_id || chatId,
            _perspective: {
                direction: 'other',
                isCurrentUser: false,
                showUsername: true
            }
        }));
        
        const messagesToRender = [...allCachedMessages, ...fileMessages]
            .filter(msg => {
                const messageId = msg.messageId || msg.id;
                const exists = existingMessageIds.has(messageId);
                return !exists;
            })
            .sort((a, b) => {
                const timeA = a.timestamp || a.createdAt || 0;
                const timeB = b.timestamp || b.createdAt || 0;
                return timeA - timeB;
            });
        
        for(const message of messagesToRender) {
            await this.messageElementRenderer.renderElement(message);
        }
    }

    /**
     * Setup Message Handling
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

    /**
     * Queue Message Send
     */
    private async queueMessageSend(): Promise<void> {
        if(this.isSending) {
            console.log('Message in progress');
            return;
        }
        this.sendQueue = [];
        await this.handleSendMessage();
    }

    /**
     * Set Current Chat
     */
    public async setCurrentChat(
        chatId: string | null,
        chatType: ChatType | null,
        members?: string[]
    ): Promise<void> {
        if(!chatId || !chatType) return;

        if(this.currentChatId && this.currentChatId !== chatId) {
            setTimeout(() => {
                this.messageRoots.forEach((root, messageId) => {
                    try {
                        root.unmount();
                    } catch (error) {
                        console.error(`Failed to unmount ${messageId}:`, error);
                    }
                });
                this.messageRoots.clear();
            }, 0);
            
            this.container = null;
            if(this.scrollHandler) {
                const oldContainer = document.querySelector<HTMLDivElement>('.chat-screen .messages');
                if(oldContainer) {
                    oldContainer.removeEventListener('scroll', this.scrollHandler);
                }
                this.scrollHandler = null;
            }
        }

        const context = this.chatRegistry.getContext(chatType, members || [], chatId);
        context.id = chatId;
        context.type = chatType;

        this.chatRegistry.setCurrentChat(context);
        const type = await this.getMetadataType(context);
        await this.updateSubscription(type, chatId, chatType);

        this.currentChatId = chatId;
        this.currentPage = 0;
        this.chunkRenderer.reset();

        const cacheService = await this.chatService.getCacheServiceClient(); 
        if(!cacheService.isChatCached(chatId)) cacheService.init(chatId);

        this.container = null;
        const container = await this.getContainer();
        if(!container) return;

        const cacheData = cacheService.getCacheData(chatId);
        if(cacheData && cacheData.messages.size > 0) {
            await this.renderAllCachedMessages(chatId);
            await this.chunkRenderer.setupScrollHandler(this.userId);
            setTimeout(() => {
                if(container) {
                    container.scrollTop = container.scrollHeight;
                }
            }, 100);
        } else {
            const userIdToUse = this.userId || this.chatManager?.userId;
            if(userIdToUse) {
                await this.loadHistory(chatId, userIdToUse);
                await this.chunkRenderer.setupScrollHandler(userIdToUse);
            } else {
                const sessionData = SessionManager?.getUserInfo?.();
                if(sessionData?.userId) {
                    await this.loadHistory(chatId, sessionData.userId);
                    await this.chunkRenderer.setupScrollHandler(sessionData.userId);
                }
            }
        }
    }

    /**
     * Metadata Type
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

    /**
     * Send Message Handler
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

            await this.sendMessage(content);
            msgInputEl.focus();
        } catch(err) {
            console.error(err);
        } finally {
            this.isSending = false;
        }
    }

    
    /**
     * Send Message Method
     */
    private async sendMessage(content: any): Promise<boolean> {
        const time = Date.now();
        const currentChat = this.chatRegistry.getCurrentChat();
        const chatId = currentChat?.id || currentChat?.chatId;
        if(!chatId) throw new Error('No chat id!');
        if(!this.socketId) throw new Error('No socket id!');

        const isGroupChat = chatId.startsWith('group_');
        const isDirectChat = chatId.startsWith('direct_');
        const tempMessageId = `msg_${time}_${Math.random().toString(36).substr(2, 9)}`
        const chatType = isGroupChat ? 'GROUP' : (isDirectChat ? 'DIRECT' : 'CHAT');

        const data = {
            senderId: this.userId,
            senderSessionId: this.socketId,
            username: this.username,
            content: content.content,
            messageId: tempMessageId,
            targetUserId: isGroupChat ? undefined : currentChat?.members.find(m => m != this.socketId),
            groupId: isGroupChat ? currentChat?.id : undefined,
            chatId: chatId,
            timestamp: time,
            chatType: content.chatType || chatType,
            type: chatType,
            isTemp: true
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
                const messageService = await this.chatService.getMessageController().getMessageService();
                const savedMessage = await messageService.saveMessages({
                    messageId: analyzedData.messageId,
                    content: analyzedData.content,
                    senderId: analyzedData.senderId,
                    username: analyzedData.username,
                    chatId: analyzedData.chatId,
                    messageType: isGroupChat ? 'GROUP' : 'DIRECT',
                    direction: 'SENT'
                });
                console.log('Message saved on server! :)');
                const messageToCache = {
                    ...analyzedData,
                    id: savedMessage.id || savedMessage.messageId,
                    messageId: savedMessage.id || savedMessage.messageId,
                    userId: analyzedData.senderId,
                    isSystem: analyzedData.isSystem,
                    direction: analysis.direction || 'self',
                    timestamp: time,
                    isTemp: false
                }
                await this.chatService.getMessageController().addMessage(chatId, messageToCache);
            } catch(err) {
                console.error('Failed to save message :(', err);
                const messageToCache = {
                    ...analyzedData,
                    id: tempMessageId,
                    userId: analyzedData.senderId,
                    isSystem: analyzedData.isSystem,
                    direction: analysis.direction || 'self',
                    timestamp: time,
                    isTemp: true
                }
                await this.chatService.getMessageController().addMessage(chatId, messageToCache);
            }
            if(isDirectChat) this.chatManager.getDirectManager().createItem(chatId);
            this.chatManager.setLastMessage(
                analyzedData.chatId,
                analyzedData.userId,
                analyzedData.messageId,
                analyzedData.content,
                analyzedData.username,
                analyzedData.isSystem
            );
        }
        return res;
    }

    /**
     * Handle Chat Message
     */
    private async handleChatMessage(data: any): Promise<void> {
        const analysis = this.messageAnalyzer.getPerspective().analyzeWithPerspective(data);
        const messageType = data.type || data.routingMetadata?.messageType || data.routingMetadata?.type;
        const isSystemMessage = messageType.includes('SYSTEM');
        const isFileMessage = data.type === 'file' || data.fileData;
        console.log('Is file message:', isFileMessage, 'Type:', data.type, 'Has fileData:', !!data.fileData);
        
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
        }

        const lastMessageId = this.lastMessageIds.get(messageType);
        if(data.messageId === lastMessageId) return;

        this.lastMessageIds.set(messageType, data.messageId);
        const perspective = data._perspective;
        const direction = perspective?.direction || analysis.direction;

        if(data.chatId && data.chatId.startsWith('direct_') && direction !== 'self') {
            const currentCount = this.chatStateManager.getMessageCount(data.chatId);
            if(currentCount === 0) {
                this.chatStateManager.incrementMessageCount(data.chatId); 
            } else {
                this.chatStateManager.updateMessageCount(data.chatId, currentCount + 1);
            }
        }

        if(isFileMessage) {
            await this.messageElementRenderer.renderFileMessage(
                {
                    ...data,
                    _perspective: perspective
                },
                await this.getContainer()
            );
        } else {
            await this.messageElementRenderer.setMessage(data, { ...analysis, direction });
        }
        
        this.chatManager.setLastMessage(
            data.chatId,
            data.userId,
            data.messageId,
            data.content,
            data.username,
            data.isSystem
        );
    }

    /**
     * Send File Message
     */
    //REMINDER FIX THE PERSPECTIVE!
    public async sendFileMessage(file: Item): Promise<boolean> {
        const time = Date.now();
        const currentChat = this.chatRegistry.getCurrentChat();
        const chatId = currentChat?.id || currentChat?.chatId;
        if(!chatId) {
            console.error('No chat id found');
            return false;
        }
        if(!this.socketId) throw new Error('No socket id!');

        const tempMessageId = `file_msg_${time}_${Math.random().toString(36).substr(2, 9)}`;
        const isGroupChat = chatId.startsWith('group_');
        const isDirectChat = chatId.startsWith('direct_');
        const chatType = isGroupChat ? 'GROUP' : (isDirectChat ? 'DIRECT' : 'CHAT');

        const data = {
            senderId: this.userId,
            senderSessionId: this.socketId,
            username: this.username,
            content: `Shared file: ${file.originalFileName}`,
            messageId: tempMessageId,
            targetUserId: isGroupChat ? undefined : currentChat?.members.find(m => m != this.socketId),
            groupId: isGroupChat ? currentChat?.id : undefined,
            chatId: chatId,
            timestamp: time,
            chatType: chatType,
            type: 'file',
            fileData: file,
            isTemp: true
        };

        const analysis = this.messageAnalyzer.analyzeMessage(data);
        const metaType = 'file';

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
                messageType: 'FILE_MESSAGE',
                isCurrentUser: true,
                isDirect: analysis.context.isDirect,
                isGroup: analysis.context.isGroup,
                isSystem: analysis.context.isSystem,
                showUsername: this.username
            },
            fileData: file
        };

        const res = await this.queueManager.sendWithRouting(
            analyzedData,
            'file',
            {
                priority: analysis.priority,
                metadata: analysis.metadata
            }
        );
        
        if(res) {
            const fileService = await this.chatService.getFileController().getFileService();
            try {
                const fileToCache = {
                    ...analyzedData,
                    id: file.fileId,
                    fileId: file.fileId,
                    userId: this.userId,
                    senderId: this.userId,
                    username: this.username,
                    isSystem: false,
                    direction: 'self',
                    timestamp: time,
                    isTemp: false,
                    type: 'file',
                    fileData: file
                };
                
                await fileService.addFile(chatId, fileToCache);
            } catch(err) {
                console.error('Failed to cache file :(', err);
                const fileToCache = {
                    ...analyzedData,
                    id: tempMessageId,
                    fileId: file.fileId,
                    userId: this.userId,
                    senderId: this.userId,
                    username: this.username,
                    isSystem: false,
                    direction: 'self',
                    timestamp: time,
                    isTemp: true,
                    type: 'file',
                    fileData: file
                };
                await fileService.addFile(chatId, fileToCache);
            }
            
            if(isDirectChat) this.chatManager.getDirectManager().createItem(chatId);
            
            this.chatManager.setLastMessage(
                chatId,
                this.userId,
                tempMessageId,
                `Shared file: ${file.originalFileName}`,
                this.username,
                false
            );
        }
        
        return res;
    }

    /**
     * Get Container
     */
    public async getContainer(): Promise<HTMLDivElement | null> {
        if(this.container) return this.container;
        
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

    /**
     * Load History
     */
    public async loadHistory(
        chatId: string,
        userId: string,
        page: number = 0
    ): Promise<void> {
        if(this.isLoadingHistory) return;
        this.isLoadingHistory = true;

        try {
            const chatData = await this.getChatData(chatId, userId, page);

            /* Messages*/
            const messages = chatData.messages;

            /* Files */
            const fileMessages = chatData.files.map(file => {
                return {
                    type: 'file',
                    fileData: {
                        ...file,
                        originalFileName: file.originalFileName || file.name,
                        mimeType: file.mimeType || file.contentType,
                        fileSize: file.fileSize || file.size,
                        fileType: file.fileSize || 'other',
                        fileId: file.fileId || file.id
                    },
                    messageId: `file_${file.fileId || file.id}`,
                    id: `file_${file.fileId || file.id}`,
                    content: `Shared file: ${file.originalFileName || file.name}`,
                    timestamp: file.uploadedAt ? new Date(file.uploadedAt).getTime() : Date.now(),
                    userId: file.userId,
                    chatId: file.chatId || chatId,
                    _perspective: {
                        direction: 'other',
                        isCurrentUser: false,
                        showUsername: true
                    }
                };
            });

            const allMessages = [...(messages || []), ...fileMessages]
                .sort((a, b) => {
                    const tA = a.timestamp || a.createdAt || 0;
                    const tB = b.timestamp || b.createdAt || 0;
                    return tA - tB;
                });
            
            await this.messageElementRenderer.renderHistory(allMessages);
            
            if(page > this.currentPage) this.currentPage = page;
            const cacheService = await this.chatService.getCacheServiceClient();
            const cacheData = cacheService.getCacheData(chatId);
            if(cacheData) cacheData.loadedPages.add(page);
        } catch(err) {
            console.error(`Failed to load chat data for ${chatId} page ${page}:`, err);
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

    /**
     * Chat Manager
     */
    public setChatManager(instance: ChatManager): void {
        this.chatManager = instance;
    }

    /**
     * Get Message Element Renderer
     */
    public getMessageElementRenderer(): MessageElementRenderer {
        return this.messageElementRenderer;
    }

    /**
     * Get Chunk Renderer
     */
    public getChunkRenderer(): ChunkRenderer {
        return this.chunkRenderer;
    }

    /**
     * Get Analyzer
     */
    public getAnalyzer(): MessageAnalyzerClient {
        return this.messageAnalyzer;
    }

    /**
     * Get Api Client
     */
    public getApiClientController(): ApiClientController {
        return this.apiClientController;
    }
}