export interface SocketEventHandler {
    eventName: string;
    handler: (socket: any, data: any, io: any) => void;
    broadcast?: boolean;
    broadcastSelf?: boolean;
    targetEvent: string | undefined
}

export class EventRegistry {
    private static events: Map<string, SocketEventHandler> = new Map();
    
    public static registerEvent(handlerConfig: SocketEventHandler): void {
        this.events.set(handlerConfig.eventName, handlerConfig);
    }

    public static registerAllEvents(events: SocketEventHandler[]): void {
        events.forEach(event => this.registerEvent(event));
    }

    public static getEvent(eventName: string): SocketEventHandler | undefined {
        return this.events.get(eventName);
    }

    public static getAllEvents(): SocketEventHandler[] {
        return Array.from(this.events.values());
    }

    public static createBroadcastEvent(
        eventName: string,
        handler: (socket: any, data: any, io: any) => any,
        broadcastSelf?: boolean,
        targetEvent?: string | undefined
    ): SocketEventHandler {
        return {
            eventName,
            handler: (socket: any, data: any, io: any) => {
                const result = handler(socket, data, io);
                if(io) {
                    const emitEventName = targetEvent || eventName;

                    if(broadcastSelf) {
                        io.emit(emitEventName, result);
                    } else {
                        socket.broadcast.emit(emitEventName, result);
                    }
                }
            },
            broadcast: true,
            broadcastSelf,
            targetEvent
        }
    }
}