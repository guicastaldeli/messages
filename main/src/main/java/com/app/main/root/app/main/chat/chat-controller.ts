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
import { FileItem, Item } from './file/file-item';
import { SessionManager } from '../_session/session-manager';
import { AddToCache, getAddToCache } from './add-to-cache';
import { NotificationControllerClient } from './notification/notification-controller-client';

export class ChatController {
    public queueManager: QueueManager;
    public socketClient: SocketClientConnect;
    private chatManager!: ChatManager;
    public chatService: ChatService;
    private messageAnalyzer: MessageAnalyzerClient;
    public messageComponent: MessageComponentGetter;
    private messageElementRenderer: MessageElementRenderer;
    private chunkRenderer: ChunkRenderer;
    private chatStateManager = ChatStateManager.getIntance();
    private apiClientController: ApiClientController;
    private notificationController: NotificationControllerClient;

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

    private fileItem: FileItem | null = null;
    private fileItemContainer: HTMLDivElement | null = null;
    private fileItemRoot: ReactDOM.Root | null = null;

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
        this.notificationController = new NotificationControllerClient(this.socketClient, this.apiClientController);
    }

    public async init(): Promise<void> {
        if(typeof document === 'undefined') return;

        this.appEl = document.querySelector<HTMLDivElement>('.app');
        this.messageElementRenderer.setApp(this.appEl!);
        const sessionData = SessionManager.getCurrentSession();
        const userId = sessionData?.userId || this.userId || '';
        this.fileItem = new FileItem({
            chatService: this.chatService,
            userId: userId,
            onFileSelect: (file) => {
                console.log('File selected:', file);
            },
            onFileDelete: (fileId) => {
                console.log('File deleted:', fileId);
            },
            onRefresh: () => {
                console.log('Refresh requested');
            }
        });
        this.messageComponent.setFileItemRef(this.fileItem);

        this.setupMessageHandling();
        await this.socketClient.connect();

        const cacheService = await this.chatService.getCacheServiceClient();
        const addToCache = getAddToCache();
        await addToCache.init(cacheService);
    }

    public async getChatData(
        chatId: string,
        userId: string,
        page: number = 0
    ): Promise<{ 
        messages: any[], 
        files: any[],
        timeline: any[], 
        fromCache: boolean 
    }> {
        return this.chatService.getData(userId, chatId, page);
    }

    public async getUserData(sessionId: string, userId: string, username: string): Promise<void> {
        this.socketId = sessionId;
        this.userId = userId;
        this.username = username;
        await this.setupSubscriptions();
        
        await this.notificationController.init(userId, username);
        
        console.log('Initializing notifications for user:', userId);
        
        const notificationService = await this.notificationController.getNotificationSevrice();
        await notificationService.loadUserNotification(userId);
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
    public async updateSubscription(
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
        console.log('Rendering cached messages for:', chatId);

        const cacheService = await this.chatService.getCacheServiceClient();
        if(!cacheService.isChatCached(chatId)) {
            console.log(`Skipping render for exited group: ${chatId}`);
            return;
        }
        
        const cacheData = await this.chatService.getCachedData(chatId);
        if(!cacheData) {
            console.log(`No cache data found for chat ${chatId}`);
            return;
        }

        const hasTimelineData = cacheData.timeline && cacheData.timeline.size > 0;
        const hasMessageData = cacheData.messages && cacheData.messages.size > 0;
        
        console.log(`Cache check: timeline=${hasTimelineData}, messages=${hasMessageData}`);
        
        if(!hasTimelineData && !hasMessageData) {
            console.log(`No timeline or message data in cache for ${chatId}`);
            return;
        }

        cacheService.validateCache(chatId);
        const container = await this.getContainer();
        if(!container) {
            console.error('Container not found');
            return;
        }

        const existingMessageIds = new Set<string>();
        const orphanedMessageIds: string[] = [];
        
        this.messageRoots.forEach((root, messageId) => {
            const element = container.querySelector(`[data-message-id="${messageId}"]`);
            if(element) {
                existingMessageIds.add(messageId);
            } else {
                orphanedMessageIds.push(messageId);
            }
        });

        if(orphanedMessageIds.length > 0) {
            console.log(`Cleaning up ${orphanedMessageIds.length} orphaned message roots`);
            orphanedMessageIds.forEach(messageId => {
                const root = this.messageRoots.get(messageId);
                if(root) {
                    try {
                        root.unmount();
                    } catch(error) {
                        console.error(`Failed to unmount orphaned root ${messageId}:`, error);
                    }
                    this.messageRoots.delete(messageId);
                }
            });
        }

        const timelineMap = cacheData.timeline;
        if(!timelineMap || !(timelineMap instanceof Map)) {
            console.error('Timeline is not a Map:', timelineMap);
            return;
        }

        const allTimelineItems = Array.from(timelineMap.values())
            .sort((a: any, b: any) => {
                const timeA = a.timestamp || new Date(a.createdAt || 0).getTime() || 0;
                const timeB = b.timestamp || new Date(b.createdAt || 0).getTime() || 0;
                return timeA - timeB;
            });
        
        console.log(`Found ${allTimelineItems.length} timeline items in cache`);
        
        const itemsToRender = allTimelineItems.filter((item: any) => {
            const itemId = item.messageId || item.id;
            return !existingMessageIds.has(itemId);
        });
        
        console.log(`Rendering ${itemsToRender.length} new items`);
        
        for(const item of itemsToRender) {
            try {
                await this.messageElementRenderer.renderElement(item);
            } catch(error) {
                console.error('Failed to render timeline item:', item.id || item.messageId, error);
            }
        }
        
        console.log('Finished rendering cached messages');
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
            if(this.scrollHandler) {
                const oldContainer = document.querySelector<HTMLDivElement>('.chat-screen .messages');
                if(oldContainer) {
                    oldContainer.removeEventListener('scroll', this.scrollHandler);
                }
                this.scrollHandler = null;
            }
            
            this.container = null;
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
        const isCached = cacheService.isChatCached(chatId);
        const isDataLoaded = this.chatService.isDataLoaded(chatId, 0);
        if(isCached && isDataLoaded) {
            console.log(`Using cached data for ${chatId}, skipping fetch`);
            await this.renderAllCachedMessages(chatId);
        } else {
            const userIdToUse = this.userId || this.chatManager?.userId;
            if(userIdToUse) {
                await this.loadHistory(chatId, userIdToUse);
            }
        }
        
        if(isCached) {
            const cacheData = cacheService.getCacheData(chatId);
            console.log(`Cache state for ${chatId}:`, {
                messages: cacheData?.messages?.size || 0,
                timeline: cacheData?.timeline?.size || 0,
                files: cacheData?.files?.size || 0,
                messageOrder: cacheData?.messageOrder?.length || 0,
                timelineOrder: cacheData?.timelineOrder?.length || 0
            });
        }
        if(!isCached) {
            cacheService.init(chatId);
        }

        this.container = null;
        const container = await this.getContainer();
        if(!container) return;

        const userIdToUse = this.userId || this.chatManager?.userId;
        if(!userIdToUse) {
            const sessionData = SessionManager?.getUserInfo?.();
            if(sessionData?.userId) {
                await this.loadHistory(chatId, sessionData.userId);
            }
        } else {
            const isNewGroup = !isCached || !isDataLoaded;
            if(isNewGroup || !isDataLoaded) {
                await this.loadHistory(chatId, userIdToUse);
            } else {
                await this.renderAllCachedMessages(chatId);
            }
        }
        
        await this.chunkRenderer.setupScrollHandler(userIdToUse || this.userId);
        setTimeout(() => {
            if(container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 100);
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

        let groupMembers: string[] = [];
        if(isGroupChat) {
            groupMembers = currentChat?.members || [];
            if(groupMembers.length === 0) {
                const groupInfo = this.chatRegistry.getGroupInfo(chatId);
                groupMembers = groupInfo?.members || [];
            }
            if(groupMembers.length === 0) {
                try {
                    const members = await this.chatManager.getGroupManager().getGroupMembers(chatId);
                    groupMembers = members;
                } catch(err) {
                    console.error('Failed to fetch from server:', err);
                }
            }
        }

        let targetUserId: string | undefined;
        if(isDirectChat) {
            targetUserId = currentChat?.members?.find(memberId => memberId !== this.userId);
        } else if(isGroupChat) {
            targetUserId = undefined;
        }

        const data = {
            senderId: this.userId,
            senderSessionId: this.socketId,
            username: this.username,
            content: content.content,
            messageId: tempMessageId,
            targetUserId: targetUserId,
            groupId: isGroupChat ? currentChat?.id : undefined,
            chatId: chatId,
            timestamp: time,
            chatType: content.chatType || chatType,
            type: chatType,
            isTemp: true,
            memberIds: isGroupChat ? groupMembers : undefined
        }

        const analysis = this.messageAnalyzer.analyzeMessage(data);
        const metaType = analysis.messageType.split('_')[0];
        const messageTypeToSend = metaType || chatType;

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
            },
            memberIds: data.memberIds,
            recipientId: data.targetUserId
        }

        const res = await this.queueManager.sendWithRouting(
            analyzedData,
            messageTypeToSend,
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
            
                if(isGroupChat && groupMembers.length > 0) {
                    const recipients = groupMembers.filter(memberId => memberId !== this.userId);
                    console.log('[GROUP NOTIFICATION] Sending to recipients:', recipients);
                    
                    if(recipients.length > 0) {
                        for(const recipientId of recipients) {
                            const notificationData = {
                                id: `notification_${tempMessageId}_${recipientId}`,
                                userId: recipientId,
                                type: 'MESSAGE',
                                title: `New message in group from ${this.username}`,
                                message: content.content,
                                chatId: chatId,
                                senderId: this.userId,
                                senderName: this.username,
                                timestamp: time,
                                isRead: false,
                                priority: 'NORMAL',
                                metadata: {
                                    messageId: tempMessageId,
                                    chatType: chatType,
                                    originalContent: content.content,
                                    isGroup: true
                                }
                            };
                            
                            await this.queueManager.sendWithRouting(
                                notificationData,
                                'notification',
                                {
                                    priority: 'NORMAL',
                                    metadata: { isNotification: true }
                                }
                            );
                        }
                    }
                } else if(targetUserId && targetUserId !== this.userId) {
                    const notificationData = {
                        id: `notification_${tempMessageId}`,
                        userId: targetUserId,
                        type: 'MESSAGE',
                        title: `New message from ${this.username}`,
                        message: content.content,
                        chatId: chatId,
                        senderId: this.userId,
                        senderName: this.username,
                        timestamp: time,
                        isRead: false,
                        priority: 'NORMAL',
                        metadata: {
                            messageId: tempMessageId,
                            chatType: chatType,
                            originalContent: content.content
                        }
                    };
                    
                    await this.queueManager.sendWithRouting(
                        notificationData,
                        'notification',
                        {
                            priority: 'NORMAL',
                            metadata: { isNotification: true }
                        }
                    );
                }

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

                const addToCache = getAddToCache();
                await addToCache.addMessage(chatId, messageToCache);
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
                
                const addToCache = getAddToCache();
                await addToCache.addMessage(chatId, messageToCache);
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
    public async handleChatMessage(data: any): Promise<void> {
        const analysis = this.messageAnalyzer.getPerspective().analyzeWithPerspective(data);
        const messageType = data.type || data.routingMetadata?.messageType || data.routingMetadata?.type;
        const isSystemMessage = messageType.includes('SYSTEM');
        const isFileMessage = data.type === 'file' || data.fileData;

        try {
            const addToCache = getAddToCache();
            if(isSystemMessage) {
                await addToCache.addSystemMessage(data.chatId, data);
            } else if(isFileMessage) {
                await addToCache.addFile(data.chatId, data);
            } else {
                await addToCache.addMessage(data.chatId, data);
            }
        } catch(err) {
            console.error('Failed to update cache:', err);
        }

        const isCurrentUserMessage = data.senderId === this.userId;
        const chatMessageEvent = new CustomEvent('chat-message-received', {
            detail: {
                chatId: data.chatId,
                message: data.content,
                sender: data.senderName || data.username || data.senderId,
                userId: data.senderId || data.userId,
                senderId: data.senderId || data.userId,
                timestamp: data.timestamp || Date.now(),
                isSystem: isSystemMessage,
                messageId: data.messageId || data.id,
                isCurrentUser: isCurrentUserMessage
            }
        });
        window.dispatchEvent(chatMessageEvent);
        console.log('Dispatched chat-message-received event:', chatMessageEvent.detail);
        
        if(isSystemMessage || isFileMessage) {
            const systemKey = `${data.event}_${data.content}_${data.timestamp}`;
            if(this.lastSystemMessageKeys.has(systemKey)) return;
            this.lastSystemMessageKeys.add(systemKey);
            this.chatManager.setLastMessage(
                data.chatId,
                data.senderId || data.userId,
                data.messageId || data.id,
                data.content,
                data.senderName || data.username || 'System',
                isSystemMessage
            );
        }

        const lastMessageId = this.lastMessageIds.get(messageType);
        if(!isFileMessage && data.messageId === lastMessageId) return;

        this.lastMessageIds.set(messageType, data.messageId);
        const perspective = data._perspective;
        const direction = perspective?.direction || analysis.direction;
        if(data.chatId && data.chatId.startsWith('direct_') && direction !== 'self') {
            const chatManager = this.chatManager;
            if(chatManager) {
                const chatExists = await this.chatExists(data.chatId);
                if(!chatExists) {
                    chatManager.updateChatMessage({
                        id: data.chatId,
                        userId: data.senderId || data.userId,
                        messageId: data.messageId || data.id,
                        lastMessage: data.content,
                        sender: data.senderName || data.username || 'Unknown',
                        timestamp: new Date(data.timestamp || Date.now()).toISOString()
                    });
                }
            }
        }

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
            data.senderId || data.userId,
            data.messageId,
            data.content,
            data.senderName || data.username,
            data.isSystem || false
        );
        
        if(!isCurrentUserMessage && data.senderId !== this.userId) {
            console.log('notification for message from other user');
            const notificationController = this.getNotificationController();
            if(notificationController) {
                const notificationData = {
                    id: `notification_${data.messageId}`,
                    userId: this.userId,
                    type: 'MESSAGE',
                    title: `New message from ${data.senderName || data.username}`,
                    message: data.content,
                    chatId: data.chatId,
                    senderId: data.senderId,
                    senderName: data.senderName || data.username,
                    timestamp: data.timestamp || Date.now(),
                    isRead: false,
                    priority: 'NORMAL',
                    metadata: {
                        messageId: data.messageId,
                        chatType: data.chatType || 'DIRECT',
                        originalContent: data.content,
                        isGroup: data.chatId?.startsWith('group_') || false
                    }
                };
                
                try {
                    await notificationController.addNotification(notificationData);
                } catch(err) {
                    console.error('Failed to create notification:', err);
                }
            }
        }
    }

    private async chatExists(chatId: string): Promise<boolean> {
        return new Promise((resolve) => {
            const checkExistence = () => {
                const chatManager = this.chatManager;
                if(chatManager) {
                    const chatList = (chatManager as any).chatList;
                    const exists = chatList.some((chat: any) => 
                        chat.id === chatId || chat.chatId === chatId
                    );
                    resolve(exists);
                } else {
                    resolve(false);
                }
            };
            checkExistence();
        });
    }

    /**
     * Send File Message
     */
    public async sendFileMessage(file: Item, userId: string): Promise<boolean> {
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
            content: file.originalFileName,
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

                const addToCache = getAddToCache();
                await addToCache.addFile(chatId, fileToCache);
                
                const actualFile = file.file;
                if(!actualFile) {
                    console.error('No File object found in Item:', file);
                    throw new Error('File object not available');
                }
                
                await fileService.uploadFile(actualFile, this.userId, chatId);
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

                const addToCache = getAddToCache();
                await addToCache.addFile(chatId, fileToCache);
                
                const actualFile = file.file;
                if(actualFile) {
                    await fileService.uploadFile(actualFile, this.userId, chatId);
                } else {
                    console.error('No File object available for upload');
                }
            }
            
            if(isDirectChat) this.chatManager.getDirectManager().createItem(chatId);
            
            this.chatManager.setLastMessage(
                chatId,
                this.userId,
                tempMessageId,
                file.originalFileName,
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
            const cacheService = await this.chatService.getCacheServiceClient();
            if(!cacheService.isChatCached(chatId)) {
                console.log(`Skipping history load for exited group: ${chatId}`);
                return;
            }

            const chatData = await this.getChatData(chatId, userId, page);
            const timeline = chatData.timeline || [];
            
            console.log(`Loading ${timeline.length} timeline items for page ${page}`);
            
            await this.messageElementRenderer.renderHistory(timeline);
            
            if(page > this.currentPage) this.currentPage = page;
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

    /**
     * Get Notification Controller
     */
    public getNotificationController(): NotificationControllerClient {
        return this.notificationController;
    }
}