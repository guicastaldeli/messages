export interface Context {
    sessionId: string;
    userId: string;
    content: string;
    targetUserId: string;
    chatId: string;
    username: string;
    senderId: string;
    isDirect: boolean;
    isGroup: boolean;
    isBroadcast: boolean;
    isSystem: boolean;
    timestamp: number;
    messageId: string;
}

export interface Metadata {
    sessionId: string;
    type: string;
    messageType: string;
    isDirect: boolean;
    isGroup: boolean;
    isBroadcast: boolean;
    isSystem: boolean;
    direction: string;
    priority: string;
    timestamp: number;
}

export interface Analysis {
    context: Context;
    routes: string[];
    metadata: Metadata;
    direction: string;
    messageType: string;
    priority: string;
    perspective?: string;
}

interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

import { DirectManager } from "../chat/direct/direct-manager";
import { MessagePerspectiveManager } from "./message-perspective-manager";

export class MessageAnalyzerClient {
    private socketId: string | null = null;
    private currentUserId: string | null = null;
    private username: string | null = null;
    
    public init(
        socketId: string,
        currentUserId: string | null,
        username: string
    ): void {
        this.socketId = socketId;
        this.currentUserId = currentUserId;
        this.username = username;
    }

    /*
    ** Analyze
    */
    public analyzeMessage(data: any): Analysis {
        const context = this.analyzeContext(data);
        const routes = this.determineRoutes(context);
        const metadata = this.generateMetadata(context);

        return {
            context,
            routes,
            metadata,
            messageType: this.getMessageType(context),
            direction: this.setDirection(data),
            priority: 'NORMAL'
        }
    }

    public analyzeContext(data: any): Context {
        const emptyPlaceholder = 'Empty! :(';

        const time = Date.now();
        const content = data.content || emptyPlaceholder;
        const userId = data.userId || this.currentUserId || emptyPlaceholder;
        const senderId = data.senderId || userId || this.currentUserId || emptyPlaceholder;
        const username = data.username || emptyPlaceholder;
        const targetUserId = data.targetUserId || data.senderId || emptyPlaceholder;
        const isGroup = 
            (data.chatId && data.chatId.startsWith('group_')) ||
            (data.chatType === 'GROUP') ||
            (data._metadata?.type === 'GROUP') ||
            (data.type === 'GROUP') ||
            (data.groupId != undefined);
        const isDirect = !!targetUserId && !isGroup;
        const isBroadcast = !isGroup && !isDirect;
        const chatId = 
            data.chatId || 
            (isGroup ? data.groupId :
            (isDirect ? DirectManager.generateChatId(data.senderId, targetUserId) :
            emptyPlaceholder));
        const isSystem = 
            data.type === 'SYSTEM' ||
            data.type === 'SYSTEM_MESSAGE' ||
            data._metadata?.type === 'SYSTEM' || 
            data.routingMetadata?.type === 'SYSTEM' ||
            Boolean(data.isSystem);

        return {
            sessionId: this.socketId || emptyPlaceholder,
            userId,
            content,
            targetUserId,
            chatId,
            username,
            senderId,
            isGroup,
            isDirect,
            isBroadcast,
            isSystem,
            timestamp: data.timestamp || time,
            messageId: data.messageId || this.generateMessageId()
        }
    }

    /*
    ** Determine Routes
    */
    public determineRoutes(context: Context): string[] {
        const routes: string[] = [];

        if(context.isDirect) {
            routes.push('DIRECT');
        }
        if(context.isGroup) {
            routes.push('GROUP');
        }
        if(context.isSystem) {
            routes.push('SYSTEM');
        }

        routes.push('CHAT');
        return routes;
    }

    /*
    ** Generate Metadata
    */
    private generateMetadata(context: Context): Metadata {
        const direction = this.setDirectionByContext(context);

        return {
            sessionId: context.sessionId,
            type: this.detectMessageType(context),
            messageType: this.getMessageType(context),
            isDirect: context.isDirect,
            isGroup: context.isGroup,
            isBroadcast: context.isBroadcast,
            isSystem: context.isSystem,
            direction: direction,
            priority: 'NORMAL',
            timestamp: context.timestamp
        }
    }

    /*
    ** Set Direction
    */
    public setDirection(data: any): string {
        const senderId = data.userId || data.senderId;
        const isSelf = senderId === this.currentUserId;
        return isSelf ? 'self' : 'other';
    }

    private setDirectionByContext(context: Context): string {
        const senderId = context.userId || context.senderId;
        const isSelf = senderId === this.currentUserId;
        return isSelf ? 'self' : 'other';
    }

    /*
    ** Message Type
    */
    public getMessageType(context: Context): any {
        if(context.isDirect) return 'DIRECT_MESSAGE';
        if(context.isGroup) return 'GROUP_MESSAGE';
        if(context.isSystem) return 'SYSTEM_MESSAGE';
        return 'BROADCAST_MESSAGE';
    }

    public detectMessageType(data: any): string {
        if(data.chatId && data.chatId.startsWith('group_')) return 'GROUP';
        if(data.groupId) return 'GROUP';
        if(data.chatType === 'GROUP') return 'GROUP';
        if(data._metadata?.type === 'GROUP') return 'GROUP';

        if(data.chatId && data.chatId.startsWith('direct_')) return 'DIRECT';
        if(data.targetUserId) return 'DIRECT';
        if(data.isDirect) return 'DIRECT';

        if(data.isSystem) return 'SYSTEM'; 
        if(data.type === 'SYSTEM') return 'SYSTEM';

        return 'CHAT';
    }

    /*
    ** Message Id
    */
    private generateMessageId(): string {
        const time = Date.now();
        return 'msg_' + time + '_' + Math.random().toString(36).substring(2, 10);
    }

    /*
    **
    ** Validate
    **
    */
    public validateMessage(data: any): ValidationResult {
        const errors: string[] = [];
        if(!data.content) errors.push('Content is required!');
        return {
            isValid: errors.length === 0,
            errors,
            warnings: data.content
        }
    }

    /*
    **
    ** Perspective
    **
    */
    public getPerspective(): MessagePerspectiveManager {
        const perspective = new MessagePerspectiveManager(
            this, 
            this.socketId!,
            this.currentUserId!
        );
        return perspective;
    }
}