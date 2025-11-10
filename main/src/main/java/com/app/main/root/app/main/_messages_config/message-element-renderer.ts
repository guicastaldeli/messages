import ReactDOM from 'react-dom/client';
import { UserColorGenerator } from "@/app/_utils/UserColorGenerator";
import { MessageManager } from "./message-manager";
import { Analysis } from './message-analyzer-client';

export class MessageElementRenderer {
    private messageManager: MessageManager;
    private app: HTMLDivElement;

    constructor(messageManager: MessageManager, app: HTMLDivElement) {
        this.messageManager = messageManager;
        this.app = app;
    }

    /*
    ** Render History
    */
    public async renderHistory(messages: any[]): Promise<void> {
        if(!this.app) throw new Error('App Element not found');
        if(messages.length === 0) return;

        const container = await this.messageManager.getContainer();
        if(!container) return;

        this.messageManager.messageRoots.forEach(root => root.unmount());
        this.messageManager.messageRoots.clear();

        for(const data of messages) await this.renderElement(data);
    }

    /*
    ** Set Message
    */
    public async setMessage(data: any, analysis: Analysis): Promise<void> {
        if(!this.app || this.messageManager.currentChatId !== data.chatId) return;
            
        const container = await this.messageManager.getContainer();
        if (!container) return;
    
        const messageId = data.messageId || data.id;
        if(this.messageManager.messageRoots.has(messageId)) return;
    
        const perspective = data._perspective || analysis.perspective;
        const senderId = data.userId;
    
        let userColor = null;
        const currentChat = this.messageManager.chatRegistry.getCurrentChat();
        if(currentChat?.type === 'GROUP' && analysis.direction === 'other') {
            userColor = UserColorGenerator.getUserColorForGroup(
                currentChat.id,
                data.senderId || 
                data.userId || 
                this.messageManager.userId || 
                senderId
            );
        }
    
        this.messageManager.messageComponent
            .setCurrentUserId(this.messageManager.userId!);
        const messageProps = {
            username: perspective.showUsername,
            userId: this.messageManager.userId,
            senderId: senderId,
            content: data.content,
            timestamp: data.timestamp,
            messageId: messageId,
            type: analysis.messageType,
            priority: analysis.priority,
            isDirect: analysis.context.isDirect,
            isGroup: analysis.context.isGroup,
            isSystem: analysis.context.isSystem,
            perspective: {
                ...perspective,
                direction: analysis.direction,
                isCurrentUser: perspective.isCurrentUser,
                showUsername: perspective.showUsername
            },
            direction: analysis.direction,
            userColor: userColor?.value,
            chatType: currentChat?.type,
        }
    
        const el = document.createElement('div');
        el.classList = 'message-container';
        el.setAttribute('data-message-id', messageId);
        container.appendChild(el);
    
        const root = ReactDOM.createRoot(el);
        root.render(this.messageManager.messageComponent.__message(messageProps));
        this.messageManager.messageRoots.set(messageId, root);
    }

    public async renderElement(data: any): Promise<void> {
        const isSystemMessage = 
            data.messageType === 'SYSTEM' ||
            data.type === 'SYSTEM' ||
            data.isSystem === true;
    
        if(isSystemMessage) {
            await this.setMessage({
                ...data,
                isSystem: true,
                direction: 'other'
            }, {
                direction: 'other',
                messageType: data.messageType || 'SYSTEM',
                priority: 'NORMAL',
                metadata: {},
                context: {
                    isDirect: false,
                    isGroup: true,
                    isSystem: true
                },
                perspective: {
                    showUsername: false
                }
            } as unknown as Analysis);
            return;
        }
    
        const perspective = this.messageManager.getAnalyzer()
            .getPerspective().calculateClientPerspective(data);
        const analysis = this.messageManager.getAnalyzer()
            .getPerspective().analyzeWithPerspective({
            ...data,
            _perspective: perspective
        });
            
        await this.setMessage(data, analysis);
    }
}