import { SocketClientConnect } from '../socket-client-connect';
import { MessageManager } from '../_messages_config/message-manager';
import { ContactServiceClient } from './contact-service-client';

export interface Contact {
    id: string;
    username: string;
    email: string;
    isOnline: boolean;
    addedAt: string;
}

export interface ContactRequest {
    requestId: string;
    fromUserId: string;
    fromUsername: string;
    createdAt: string;
}

export interface ContactServiceClientProps {
    socketClient: SocketClientConnect;
    messageManager: MessageManager;
    userId: string;
    username: string;
}

export interface ContactLayoutProps {
    contactService: ContactServiceClient;
}