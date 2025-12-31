import { ChatType } from "../chat/chat-registry";

/*
** Handler
*/
export interface MessageHandler {
    canHandle(chatType: ChatType): boolean;
    getSubscriptionPattern(chatId: string): string;
    getMessageType(): string;
    validateMessage?(message: any): boolean;
    beforeSend?(message: any): any;
}

class ChatMessageHandler implements MessageHandler {
    canHandle(chatType: ChatType): boolean {
        return chatType === 'CHAT';
    }
    getSubscriptionPattern(): string {
        return 'CHAT'
    }
    getMessageType(): string {
        return 'chat';
    }
}

class SystemMessageHandler implements MessageHandler {
    canHandle(chatType: ChatType): boolean {
        return chatType === 'SYSTEM';
    }
    getSubscriptionPattern(): string {
        return 'SYSTEM'
    }
    getMessageType(): string {
        return 'system';
    }
}

class DirectMessageHandler implements MessageHandler {
    canHandle(chatType: ChatType): boolean {
        return chatType === 'DIRECT';
    }
    getSubscriptionPattern(chatId: string): string {
        return `DIRECT:${chatId}`;
    }
    getMessageType(): string {
        return 'direct';
    }
    validateMessage(message: any): boolean {
        return !!message.targetUserId;
    }
}

class GroupMessageHandler implements MessageHandler {
    canHandle(chatType: ChatType): boolean {
        return chatType === 'GROUP';
    }
    getSubscriptionPattern(chatId: string): string {
        return `GROUP:${chatId}`;
    }
    getMessageType(): string {
        return 'group';
    }
    validateMessage(message: any): boolean {
        return !!message.groupId && message.groupId.startsWith('group_');
    }
    beforeSend(message: any) {
        return {
            ...message,
            chatType: 'GROUP'
        }
    }
}

/*
** Registered
*/
export class RegisteredMessageHandlers {
    public messageHandlers: MessageHandler[] = [];
    public register(): void {
        this.messageHandlers = [
            new ChatMessageHandler(),
            new SystemMessageHandler(),
            new DirectMessageHandler(),
            new GroupMessageHandler()
        ]
    }
}