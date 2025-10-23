interface Context {
    sessionId: string;
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

interface Metadata {
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
}

interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

import { DirectManager } from "../chat/direct/direct-manager";

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

    private analyzeContext(data: any): Context {
        const emptyPlaceholder = 'Empty! :(';

        const time = Date.now();
        const content = data.content || emptyPlaceholder;
        const targetUserId = data.targetUserId || data.senderId || emptyPlaceholder;
        const senderId = data.senderId || emptyPlaceholder;
        const username = data.username || emptyPlaceholder;
        const isGroup = 
            (data.chatId && data.chatId.startsWith('group_')) ||
            (data.chatType === 'GROUP') ||
            (data._metadata?.type === 'GROUP') ||
            (data.type === 'GROUP') ||
            (data.groupId != undefined);
        const isDirect = !!targetUserId && !isGroup;
        const isBroadcast = !isGroup && !isDirect;
        const isSystem = data.type === 'SYSTEM';
        const chatId = 
            data.chatId || 
            (isGroup ? data.groupId :
            (isDirect ? DirectManager.generateChatId(data.senderId, targetUserId) :
            emptyPlaceholder));

        return {
            sessionId: this.socketId || emptyPlaceholder,
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
    private determineRoutes(context: Context): string[] {
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
        if(!this.socketId) return 'other';

        const isSelf = (
            data.senderId === this.socketId ||
            data.senderId === this.currentUserId ||
            data.username === this.username ||
            data._metadata?.isSelf ||
            data.routingMetadata?.isSelf
        );

        return isSelf ? 'self' : 'other';
    }

    private setDirectionByContext(context: Context): string {
        return context.senderId === this.socketId ? 'self' : 'other';
    }

    /*
    ** Message Type
    */
    private getMessageType(context: Context): any {
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
        if(data.targetUserId) return 'DIRECT';
        if(data.type === 'SYSTEM') return 'SYSTEM';
        return 'CHAT';
    }

    /*
    **
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
}