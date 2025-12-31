import { SocketClientConnect } from '../socket-client-connect';
import { ChatController } from '../chat/chat-controller';
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
    chatController: ChatController;
    userId: string;
    username: string;
}

export interface ContactLayoutProps {
    contactService: ContactServiceClient;
}