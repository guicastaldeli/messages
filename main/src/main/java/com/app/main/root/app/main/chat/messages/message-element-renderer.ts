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

    /**
     * Render History
     */
    public async renderHistory(messages: any[]): Promise<void> {
        if(!this.app) throw new Error('App Element not found');
        if(messages.length === 0) return;

        const container = await this.chatController.getContainer();
        if(!container) return;

        this.lastScrollTop = container.scrollTop;
        this.lastScrollHeight = container.scrollHeight;

        const existingMessageIds = new Set();
        const messageElements = container.querySelectorAll('[data-message-id]');
        messageElements.forEach(el => {
            const messageId = el.getAttribute('data-message-id');
            if(messageId) existingMessageIds.add(messageId);
        });

        this.chatController.messageRoots.forEach((_, messageId) => {
            existingMessageIds.add(messageId);
        });
        const newMessages = messages.filter(msg => {
            const id = msg.id || msg.messageId;
            return !existingMessageIds.has(id);
        });

        console.log(`Rendering ${newMessages.length} new messages out of ${messages.length} total`);

        if(newMessages.length === 0) return;

        const sortedMessages = newMessages.sort((a, b) => {
            const timeA = a.timestamp || a.createdAt || 0;
            const timeB = b.timestamp || b.createdAt || 0;
            return timeA - timeB;
        });

        for(const data of sortedMessages) {
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

    /**
     * Set Message
     */
    public async setMessage(data: any, analysis: Analysis): Promise<void> {
        const messageId = data.messageId || data.id;
        console.log(`[setMessage] ===== START ===== Message: ${messageId}`);
        console.log(`[setMessage] Data chatId: ${data.chatId}, Current chatId: ${this.chatController.currentChatId}`);
        
        if(!this.app) {
            console.log(`[setMessage] ===== ABORT (no app) ===== Message: ${messageId}`);
            return;
        }
        
        if(this.chatController.currentChatId !== data.chatId) {
            console.log(`[setMessage] ===== ABORT (chatId mismatch) ===== Message: ${messageId}`);
            console.log(`[setMessage] Expected: ${this.chatController.currentChatId}, Got: ${data.chatId}`);
            return;
        }
            
        console.log(`[setMessage] Getting container...`);
        const container = await this.chatController.getContainer();
        if(!container) {
            console.log(`[setMessage] ===== ABORT (no container) ===== Message: ${messageId}`);
            return;
        }
        console.log(`[setMessage] Container found`);

        // Check if already rendered
        const hasRoot = this.chatController.messageRoots.has(messageId);
        console.log(`[setMessage] Checking if already rendered... Has root: ${hasRoot}`);
        if(hasRoot) {
            console.log(`[setMessage] ===== ABORT (already rendered) ===== Message: ${messageId}`);
            return;
        }

        const isFileMessage = 
            data.type === 'file' || 
            data.fileData || 
            data.file_id || 
            data.original_filename || 
            data.mime_type;
            
        console.log(`[setMessage] Is file message: ${isFileMessage}`);
        if(isFileMessage) {
            console.log(`[setMessage] Redirecting to renderFileMessage...`);
            await this.renderFileMessage(data, container);
            console.log(`[setMessage] ===== END (file redirect) ===== Message: ${messageId}`);
            return;
        }

        console.log(`[setMessage] Building message props...`);
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

        console.log(`[setMessage] Message props:`, messageProps);
        console.log(`[setMessage] Creating DOM element...`);

        const el = document.createElement('div');
        el.classList = 'message-container';
        el.setAttribute('data-message-id', messageId);
        el.setAttribute('data-timestamp', data.timestamp?.toString() || Date.now().toString());
        
        const messageIdStr = messageId ? messageId.toString() : '';
        const isNewMessage = messageIdStr && messageIdStr.startsWith('msg_');
        
        console.log(`[setMessage] Inserting element into container... (isNew: ${isNewMessage})`);
        if(isNewMessage) {
            container.appendChild(el);
        } else {
            container.insertBefore(el, container.firstChild);
        }

        console.log(`[setMessage] Creating React root...`);
        const root = ReactDOM.createRoot(el);
        
        console.log(`[setMessage] Rendering React component...`);
        root.render(this.chatController.messageComponent.__message(messageProps));
        
        console.log(`[setMessage] Storing React root in map...`);
        this.chatController.messageRoots.set(messageId, root);
        
        console.log(`[setMessage] ===== SUCCESS ===== Message: ${messageId}`);
        console.log(`[setMessage] Total roots now: ${this.chatController.messageRoots.size}`);
    }

    /**
     * Render Element
     */
    public async renderElement(data: any): Promise<void> {
        const messageId = data.messageId || data.id;
        console.log(`[renderElement] ===== START ===== Message: ${messageId}`);
        console.log(`[renderElement] Data:`, {
            messageId,
            id: data.id,
            chatId: data.chatId,
            content: data.content,
            type: data.type,
            messageType: data.messageType,
            isSystem: data.isSystem
        });
        
        const hasRoot = this.chatController.messageRoots.has(messageId);
        console.log(`[renderElement] Has React root already? ${hasRoot}`);
        if(hasRoot) {
            console.log(`[renderElement] ===== SKIP (has root) ===== Message: ${messageId}`);
            return;
        }
        
        const isSystemMessage = 
            data.messageType === 'SYSTEM' ||
            data.type === 'SYSTEM' ||
            data.isSystem === true;

        console.log(`[renderElement] Is system message? ${isSystemMessage}`);

        if(isSystemMessage) {
            console.log(`[renderElement] Rendering as SYSTEM message: ${messageId}`);
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
            console.log(`[renderElement] ===== END (system) ===== Message: ${messageId}`);
            return;
        }

        const isFileMessage = 
            data.type === 'file' || 
            data.fileData || 
            data.file_id || 
            data.original_filename || 
            data.mime_type;
        
        console.log(`[renderElement] Is file message? ${isFileMessage}`);
            
        if(isFileMessage) {
            console.log(`[renderElement] Rendering as FILE message: ${messageId}`);
            await this.renderFileMessage(data, null);
            console.log(`[renderElement] ===== END (file) ===== Message: ${messageId}`);
            return;
        }

        console.log(`[renderElement] Rendering as REGULAR message: ${messageId}`);
        console.log(`[renderElement] Getting perspective for message...`);
        
        const perspective = this.chatController.getAnalyzer()
            .getPerspective().calculateClientPerspective(data);
        console.log(`[renderElement] Perspective calculated:`, perspective);
        
        const analysis = this.chatController.getAnalyzer()
            .getPerspective().analyzeWithPerspective({
            ...data,
            _perspective: perspective
        });
        console.log(`[renderElement] Analysis completed:`, analysis);
            
        console.log(`[renderElement] Calling setMessage...`);
        await this.setMessage(data, analysis);
        console.log(`[renderElement] ===== END (regular) ===== Message: ${messageId}`);
    }

    public async renderFileMessage(messageData: any, container: HTMLDivElement | null): Promise<void> {
        if(!container) {
            container = await this.chatController.getContainer();
            if(!container) return;
        }

        try {            
            if(messageData.type === 'file' || messageData.fileData) {
                const messageComponent = this.chatController.messageComponent;
                if(messageComponent && messageComponent.__file) {
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

    public getMessageCount(): number {
        return this.chatController.messageRoots.size;
    }
}