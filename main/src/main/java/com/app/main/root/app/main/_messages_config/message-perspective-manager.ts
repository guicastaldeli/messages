import { Context } from "./message-analyzer-client";
import { MessageAnalyzerClient, Analysis, Metadata } from "./message-analyzer-client";

export class MessagePerspectiveManager {
    private messageAnalyzerClient: MessageAnalyzerClient;
    private currentSessionId: string;

    constructor(
        messageAnalyzerClient: MessageAnalyzerClient,
        currentSessionId: string
    ) {
        this.messageAnalyzerClient = messageAnalyzerClient;
        this.currentSessionId = currentSessionId;
    }

    /*
    ** Analyze
    */
    public analyzeWithPerspective(data: any): Analysis {
        const perspective = this.calculateClientPerspective(data);
        const context = this.messageAnalyzerClient.analyzeContext(data);
        return {
            context,
            routes: this.messageAnalyzerClient.determineRoutes(context),
            metadata: this.generateMetadataPerspective(context, perspective),
            messageType: perspective.perspectiveType || this.messageAnalyzerClient.getMessageType(context),
            direction: perspective.direction || 'other',
            priority: 'NORMAL',
            perspective: perspective
        }
    }

    public calculateClientPerspective(data: any): any {
        const senderId = data.senderId;
        const currentUserId = this.currentSessionId;
        const isSelf = senderId === currentUserId;
        const isGroup = data.isGroup || data.chatId?.startsWith('_group');
        const isSystem = data.isSystem || data.type === 'SYSTEM';
        const shouldShowUsername = !isSelf && data.username;

        if (isSystem) {
            return {
                direction: 'system',
                perspectiveType: 'SYSTEM_MESSAGE',
                isDirect: false,
                isGroup: false,
                isSystem: true,
                isBroadcast: false,
                showUsername: false,
                displayUsername: null,
                isCurrentUser: false
            };
        }
        if (isSelf) {
            return {
                direction: 'self',
                perspectiveType: isGroup ? 'GROUP_SELF_SENT' : 'SELF_SENT',
                isDirect: !isGroup,
                isGroup: isGroup,
                isSystem: false,
                isBroadcast: false,
                showUsername: false,
                displayUsername: null,
                isCurrentUser: true
            };
        } else {
            return {
                direction: 'other',
                perspectiveType: isGroup ? 'GROUP_OTHER_USER' : 'OTHER_USER',
                isDirect: !isGroup,
                isGroup: isGroup,
                isSystem: false,
                isBroadcast: false,
                showUsername: shouldShowUsername,
                displayUsername: data.username,
                isCurrentUser: false
            };
        }
    }

    /*
    ** Metadata
    */
    private generateMetadataPerspective(
        context: Context,
        perspective: any
    ): Metadata {
        return {
            sessionId: this.currentSessionId,
            type: this.messageAnalyzerClient.detectMessageType(context),
            messageType: this.messageAnalyzerClient.getMessageType(context),
            isDirect: perspective.isDirect,
            isGroup: perspective.isGroup,
            isBroadcast: perspective.isBroadcast,
            isSystem: perspective.isSystem,
            direction: perspective.direction,
            priority: 'NORMAL',
            timestamp: context.timestamp
        }
    }
}