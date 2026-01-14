import { SocketClientConnect } from "../socket-client-connect";
import { ChatService } from "./chat-service";
import { ChatManager } from "./chat-manager";
import { ChatStateManager } from "./chat-state-manager";

export class Loader {
    private socketClient: SocketClientConnect;
    private chatService: ChatService;
    private chatManager: ChatManager;
    private chatStateManager = ChatStateManager.getIntance();

    constructor(
        socketClient: SocketClientConnect,
        chatService: ChatService,
        chatManager: ChatManager
    ) {
        this.socketClient = socketClient;
        this.chatService = chatService;
        this.chatManager = chatManager;
    }

    /**
     * Load Chat Items
     */
    public async loadChatItems(userId: string): Promise<void> {
        try {
            console.log(`[Loader.loadChatItems] Loading chat items for userId: ${userId}`);
            
            const stream = await this.chatService.streamUserChats(userId);
            stream.on('chat_data', (data: any) => {
                this.processChatItem(data.chat, userId);
            });
            stream.on('complete', (data: any) => {
                this.emitStreamComplete('chat-stream-complete', {
                    userId,
                    page: data.page,
                    total: data.total
                });
            });
            stream.on('error', (err: any) => {
                console.error('Chat streaming error:', err);
                this.emitStreamError('chats-stream-error', err);
            });
            stream.on('processing-error', (err: any) => {
                console.error('Chat processing error:', err.error);
                if(err.original && err.original.chat) {
                    this.processChatItem(err.original.chat, userId);
                }
            });

            await stream.start();
        } catch(err) {
            console.error('Failed to stream chat items:', err);
            this.emitStreamError('chats-stream-error', err);
        }
    }

    private async createChatItem(chat: any, userId: string): Promise<any> {
        const hasMessages = await this.chatHasMessages(userId, chat.id);
        
        return {
            id: chat.id,
            chatId: chat.id,
            groupId: chat.id,
            name: chat.name || chat.contactUsername || 'Unknown',
            type: chat.type || 'DIRECT',
            creator: chat.creator || chat.creatorId,
            members: chat.members || [],
            unreadCount: chat.unreadCount || 0,
            lastMessage: await this.setLastMessage(userId, chat),
            lastMessageTime: chat.lastMessageTime || chat.createdAt,
            timestamp: new Date(chat.lastMessageTime || chat.createdAt),
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt,
            streamed: true,
            hasMessages: hasMessages
        };
    }

    /**
     * Process Chat Item
     */
    public async processChatItem(chat: any, userId: string): Promise<void> {
        try {
            const shouldContinue = await this.setChatState(chat, userId);
            if(!shouldContinue) return;

            const chatItem = await this.createChatItem(chat, userId);
            this.emitChatItemAdded(chatItem);

            const chatEvent = new CustomEvent('chat-item-streamed', {
                detail: chatItem
            });
            window.dispatchEvent(chatEvent);
        } catch(err) {
            console.error('Failed to process chat item:', err);
        }
    }

    private emitChatItemAdded(chatItem: any): void {
        const event = new CustomEvent('chat-item-added', {
            detail: {
                id: chatItem.id,
                chatId: chatItem.chatId,
                groupId: chatItem.groupId,
                name: chatItem.name,
                type: chatItem.type,
                lastMessage: chatItem.lastMessage,
                timestamp: chatItem.timestamp,
                streamed: true
            }
        });
        window.dispatchEvent(event);
    }

    private emitMessageEvent(eventName: string, data: any): void {
        const event = new CustomEvent(eventName, { detail: data });
        window.dispatchEvent(event);
    }

    private emitStreamComplete(eventName: string, data: any): void {
        const event = new CustomEvent(eventName, { detail: data });
        window.dispatchEvent(event);
    }

    private emitStreamError(eventName: string, error: any): void {
        const event = new CustomEvent(eventName, { detail: { error } });
        window.dispatchEvent(event);
    }

    private async chatHasMessages(userId: string, chatId: string): Promise<boolean> {
        try {
            const chatData = await this.chatService.getData(userId, chatId, 0);
            const hasTimelineItems = chatData.timeline && chatData.timeline.length > 0;
            const hasRegularMessages = chatData.messages && chatData.messages.length > 0;
            const hasFiles = chatData.files && chatData.files.length > 0;
            
            console.log(`Chat ${chatId} content check:`, {
                timeline: chatData.timeline?.length || 0,
                messages: chatData.messages?.length || 0,
                files: chatData.files?.length || 0,
                hasTimelineItems,
                hasRegularMessages,
                hasFiles
            });
            
            return hasTimelineItems || hasRegularMessages || hasFiles;
        } catch(err) {
            console.error('Failed to check if chat has messages:', err);
            return false;
        }
    }

    private async setLastMessage(userId: string, chat: any): Promise<string> {
        const chatId = chat.id;
        try {
            const chatData = await this.chatService.getData(userId, chatId, 0);
            
            const timeline = chatData.timeline || [];
            const sortedTimeline = timeline.sort((a: any, b: any) => {
                const timeA = a.timestamp || new Date(a.createdAt || 0).getTime() || 0;
                const timeB = b.timestamp || new Date(b.createdAt || 0).getTime() || 0;
                return timeB - timeA;
            });
            
            if(sortedTimeline.length > 0) {
                const lastItem = sortedTimeline[0];
                if(lastItem.type === 'file') {
                    return lastItem.fileData?.originalFileName || 'file';
                } else if(lastItem.type === 'system' || lastItem.isSystem) {
                    console.log('SYSTEM>>>>', lastItem.content)
                    return lastItem.content || 'System message';
                } else {
                    return lastItem.content || 'Message';
                }
            }
            
            const lastMessageData = await this.chatManager.lastMessage(userId, chatId);
            if(!lastMessageData) return 'No messages yet';
            if(lastMessageData.isSystem) {
                return lastMessageData.content;
            }
            
            const senderUsername = lastMessageData.senderUsername || lastMessageData.sender;
            const isCurrentUser = lastMessageData.sender === this.chatManager.userId;
            const formattedMessage = this.chatManager.formattedMessage(
                chatId,
                lastMessageData.content,
                isCurrentUser,
                senderUsername,
                lastMessageData.isSystem
            );

            if(chat.type === 'DIRECT') {
                return formattedMessage; 
            } else {
                return this.chatManager.formattedLastMessage(formattedMessage);
            }
        } catch(err) {
            console.error('Failed to get last message:', err);
            return 'Error loading messages';
        }
    }

    private async setChatState(chat: any, userId: string): Promise<boolean> {
        const chatId = chat.id;
        
        const hasContent = await this.chatHasMessages(userId, chatId);
        this.chatStateManager.initChatState(chatId, hasContent ? 1 : 0);
        
        return true;
    }
}