import ReactDOM from 'react-dom/client';
import { UserColorGenerator } from "@/app/_utils/UserColorGenerator";
import { ChatController } from '../chat-controller';
import { Analysis } from './message-analyzer-client';

export class MessageElementRenderer {
    private chatController: ChatController;
    private app!: HTMLElement;

    private lastScrollTop: number = 0;
    private lastScrollHeight: number = 0;

    constructor(chatController: ChatController) {
        this.chatController = chatController;
    }

    public setApp(app: HTMLElement) {
        this.app = app;
    }

    /*
    ** Render History
    */
    public async renderHistory(messages: any[]): Promise<void> {
        if(!this.app) throw new Error('App Element not found');
        if(messages.length === 0) return;

        const container = await this.chatController.getContainer();
        if(!container) return;

        this.lastScrollTop = container.scrollTop;
        this.lastScrollHeight = container.scrollHeight;

        const exMessagesIds = new Set(this.chatController.messageRoots.keys());
        const newMessages = messages.filter(msg => {
            const id = msg.id || msg.messageId;
            return !exMessagesIds.has(id);
        });

        const fileMessages = newMessages.filter(msg => 
            msg.type === 'file' || msg.fileData
        );
        const regularMessages = newMessages.filter(msg => 
            !(msg.type === 'file' || msg.fileData)
        );

        const sortedMessages = regularMessages.sort((a, b) => {
            const timeA = a.timestamp || a.createdAt || 0;
            const timeB = b.timestamp || b.createdAt || 0;
            return timeA - timeB;
        });
        const sortedFileMessages = fileMessages.sort((a, b) => {
            const timeA = a.timestamp || a.createdAt || 0;
            const timeB = b.timestamp || b.createdAt || 0;
            return timeA - timeB;
        });
        const allMessages = [...sortedMessages, ...sortedFileMessages].sort((a, b) => {
            const timeA = a.timestamp || a.createdAt || 0;
            const timeB = b.timestamp || b.createdAt || 0;
            return timeA - timeB;
        });

        for(const data of allMessages) {
            await this.renderElement(data);
        }
        
        this.restoreScrollPos(container);
    }

    private restoreScrollPos(container: HTMLDivElement): void {
        setTimeout(() => {
            if(this.lastScrollHeight > 0) {
                const heightDiff = container.scrollHeight - this.lastScrollHeight;
                container.scrollTop = this.lastScrollTop + heightDiff;
            }
            this.lastScrollTop = 0;
            this.lastScrollHeight = 0;
        }, 50);
    }

    /*
    ** Set Message
    */
    public async setMessage(data: any, analysis: Analysis): Promise<void> {
        if(!this.app || this.chatController.currentChatId !== data.chatId) return;
            
        const container = await this.chatController.getContainer();
        if (!container) return;
    
        const messageId = data.messageId || data.id;
        if(this.chatController.messageRoots.has(messageId)) return;

        const isFileMessage = 
            data.type === 'file' || 
            data.fileData || 
            data.file_id || 
            data.original_filename || 
            data.mime_type;
        if(isFileMessage) {
            await this.renderFileMessage(data, container);
            return;
        }
    
        const perspective = data._perspective || analysis.perspective;
        const senderId = data.userId;
    
        let userColor = null;
        const currentChat = this.chatController.chatRegistry.getCurrentChat();
        if(currentChat?.type === 'DIRECT' && analysis.direction === 'other') {
            userColor = UserColorGenerator.getColor('pink');
        }
        if(currentChat?.type === 'GROUP' && analysis.direction === 'other') {
            userColor = UserColorGenerator.getUserColorForGroup(
                currentChat.id,
                data.senderId || 
                data.userId || 
                this.chatController.userId || 
                senderId
            );
        }
    
        this.chatController.messageComponent
            .setCurrentUserId(this.chatController.userId!);
        const messageProps = {
            username: perspective.showUsername,
            userId: this.chatController.userId,
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
            chatType: currentChat?.type
        }
    
        const el = document.createElement('div');
        el.classList = 'message-container';
        el.setAttribute('data-message-id', messageId);
        const messageIdStr = messageId ? messageId.toString() : '';
        const isNewMessage = messageIdStr && messageIdStr.startsWith('msg_');
        if (isNewMessage) {
            container.appendChild(el);
        } else {
            container.insertBefore(el, container.firstChild);
        }
    
        const root = ReactDOM.createRoot(el);
        root.render(this.chatController.messageComponent.__message(messageProps));
        this.chatController.messageRoots.set(messageId, root);
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

        const isFileMessage = 
            data.type === 'file' || 
            data.fileData || 
            data.file_id || 
            data.original_filename || 
            data.mime_type;
        if(isFileMessage) {
            await this.renderFileMessage(data, null);
            return;
        }
    
        const perspective = this.chatController.getAnalyzer()
            .getPerspective().calculateClientPerspective(data);
        const analysis = this.chatController.getAnalyzer()
            .getPerspective().analyzeWithPerspective({
            ...data,
            _perspective: perspective
        });
            
        await this.setMessage(data, analysis);
    }

    public async renderFileMessage(messageData: any, container: HTMLDivElement | null): Promise<void> {
        if(!container) {
            container = await this.chatController.getContainer();
            if (!container) return;
        }

        try {            
            if(messageData.type === 'file' || messageData.fileData) {
                const messageComponent = this.chatController.messageComponent;
                if (messageComponent && messageComponent.__file) {
                    const analysis = this.chatController.getAnalyzer()
                        .getPerspective().analyzeWithPerspective(messageData);
                    
                    const perspective = messageData._perspective || analysis.perspective;
                    const currentChat = this.chatController.chatRegistry.getCurrentChat();
                    
                    let userColor = null;
                    if(currentChat?.type === 'DIRECT' && analysis.direction === 'other') {
                        userColor = UserColorGenerator.getColor('pink');
                    }
                    if(currentChat?.type === 'GROUP' && analysis.direction === 'other') {
                        userColor = UserColorGenerator.getUserColorForGroup(
                            currentChat.id,
                            messageData.senderId || 
                            messageData.userId || 
                            this.chatController.userId
                        );
                    }

                    const messageProps = {
                        username: perspective.showUsername,
                        userId: this.chatController.userId,
                        senderId: messageData.userId,
                        content: messageData.content,
                        timestamp: messageData.timestamp,
                        messageId: messageData.messageId || messageData.id,
                        type: 'file',
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
                        currentUserId: this.chatController.userId,
                        fileData: messageData.fileData || messageData
                    };

                    const messageDiv = document.createElement('div');
                    messageDiv.className = `message-container file-message-container`;
                    messageDiv.setAttribute('data-message-id', messageProps.messageId);
                    
                    const root = ReactDOM.createRoot(messageDiv);
                    root.render(messageComponent.__file(messageProps));
                    
                    this.insertMessageInOrder(container, messageDiv, messageProps.timestamp);
                    this.chatController.messageRoots.set(messageProps.messageId, root);
                    
                } else {
                    console.error('File message rendering not available, falling back to regular message');
                    await this.renderElement(messageData);
                }
            } else {
                await this.renderElement(messageData);
            }
        } catch (error) {
            console.error('Error rendering file message:', error);
            await this.renderElement(messageData);
        }
    }

    private insertMessageInOrder(container: HTMLDivElement, newElement: HTMLElement, timestamp: number): void {
        const messageElements = Array.from(container.children);
        let insertIndex = 0;
        
        for(let i = 0; i < messageElements.length; i++) {
            const element = messageElements[i];
            const elementTimestamp = this.getMessageTimestamp(element);
            
            if(timestamp > elementTimestamp) {
                insertIndex = i + 1;
            } else {
                break;
            }
        }
        
        if(insertIndex >= container.children.length) {
            container.appendChild(newElement);
        } else {
            const referenceElement = container.children[insertIndex];
            container.insertBefore(newElement, referenceElement);
        }
    }

    private getMessageTimestamp(element: Element): number {
        const timestampAttr = element.getAttribute('data-timestamp');
        if(timestampAttr) {
            return parseInt(timestampAttr, 10);
        }
        
        return Date.now();
    }

    public clearRenderedMessages(): void {
        this.chatController.messageRoots.forEach(root => root.unmount());
        this.chatController.messageRoots.clear();
    }

    public getMessageCount(): number {
        return this.chatController.messageRoots.size;
    }
}