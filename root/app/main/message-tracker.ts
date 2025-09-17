export interface MessageLog {
    id: string;
    eventName: string;
    data: any;
    timestamp: Date;
    direction: 'sent' | 'received';
    senderId?: string;
    username?: string;
}

export class MessageTracker {
    private static instance: MessageTracker;
    private messageLogs: MessageLog[] = [];
    private maxLogs: number = 1000;

    public static getInstance(): MessageTracker {
        if(!MessageTracker.instance) MessageTracker.instance = new MessageTracker();
        return MessageTracker.instance;
    }

    public trackMessage(
        eventName: string,
        data: any,
        direction: 'sent' | 'received',
        senderId?: string,
        username?: string
    ): void {
        const messageLog: MessageLog = {
            id: this.generateId(),
            eventName,
            data,
            timestamp: new Date(),
            direction,
            senderId,
            username
        }
        this.messageLogs.push(messageLog);

        if(this.messageLogs.length > this.maxLogs) this.messageLogs = this.messageLogs.slice(-this.maxLogs);
        this.emitMessageEvent(messageLog);
    }

    public getMessageLogs(): MessageLog[] {
        return [...this.messageLogs];
    }

    public clearLogs(): void {
        this.messageLogs = [];
    }

    private generateId(): string {
        const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        return id;
    }

    private emitMessageEvent(log: MessageLog): void {
        if(log.eventName === 'chat' || log.eventName === 'new-message') {
            const chatEvent = new CustomEvent('message-tracked', {
                detail: {
                    type: log.eventName,
                    data: log.data,
                    senderId: log.senderId,
                    username: log.username,
                    timestamp: log.timestamp,
                    direction: log.direction
                }
            });
            if(
                typeof window !== 'undefined' &&
                typeof (window as any).dispatchEvent === 'function'
            ) {
                window.dispatchEvent(chatEvent);
            }
        }
    }

    /*
    ** 
    *** test logs (**in case it needed)
    **
    private logToConsole(log: MessageLog): void {
        const timestamp = log.timestamp.toISOString().split('T')[1].split('.')[0];
        const direction = log.direction === 'sent' ? '📤 SENT' : '📥 RECEIVED';
        const userInfo = log.username ? `(${log.username})` : ' no user';

        console.groupCollapsed(`%c${direction} ${log.eventName}${userInfo} @ ${timestamp}`, 
        `color: ${log.direction === 'sent' ? '#4CAF50' : '#2196F3'}; font-weight: bold;`);
        
        console.log('Event:', log.eventName);
        console.log('Direction:', log.direction);
        console.log('Timestamp:', log.timestamp.toISOString());

        if(log.senderId) console.log('SENDER ID:', log.senderId);
        if(log.username) console.log('Username:', log.username);
        console.log('Data:', log.data);
        console.groupEnd();
    }
    */
}