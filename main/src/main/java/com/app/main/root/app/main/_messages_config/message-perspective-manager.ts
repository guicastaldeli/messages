import { Context } from "./message-analyzer-client";
import { MessageAnalyzerClient, Analysis, Metadata } from "./message-analyzer-client";

export class MessagePerspectiveManager {
    private messageAnalyzerClient: MessageAnalyzerClient;

    constructor(messageAnalyzerClient: MessageAnalyzerClient) {
        this.messageAnalyzerClient = messageAnalyzerClient;
    }

    /*
    ** Analyze
    */
    public analyzeWithPerspective(data: any): Analysis {
        const perspective = data._perspective;
        if(!perspective) {
            return this.messageAnalyzerClient.analyzeMessage(data);
        }

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

    /*
    ** Metadata
    */
    private generateMetadataPerspective(
        context: Context,
        perspective: any
    ): Metadata {
        return {
            sessionId: context.sessionId,
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