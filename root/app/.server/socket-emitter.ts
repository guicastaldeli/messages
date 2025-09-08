import io, { Socket } from 'socket.io-client';

export interface EventHandler {
    eventName: string;
    handler: (data: any) => void;
    autoRegister?: boolean;
}

export interface EmitHandler {
    eventName: string;
    emit: (data: any) => void;
}

export class SocketEmitter {
    private static instance: SocketEmitter;
    private socket: typeof Socket | null = null;

    private eventHandlers: Map<string, EventHandler> = new Map();
    private emitHandlers: Map<string, EmitHandler> = new Map();

    constructor(socket: typeof Socket) {
        this.socket = socket;
    }

    public static getInstance(socket?: typeof Socket): SocketEmitter {
        if(!SocketEmitter.instance) {
            if(!socket) throw new Error('socket err');
            SocketEmitter.instance = new SocketEmitter(socket);
        }
        return SocketEmitter.instance;
    }

    public registerEventHandler(handlerConfig: EventHandler): void {
        if(this.socket && handlerConfig.autoRegister !== false) {
            this.socket.on(handlerConfig.eventName, (data: any) => {
                handlerConfig.handler(data);
            });
        }
    }

    public registerAllEventHandlers(handlers: EventHandler[]): void {
        handlers.forEach(handler => this.registerEventHandler(handler));
    }

    public registerEmitHandler(handlerConfig: EmitHandler): void {
        this.emitHandlers.set(handlerConfig.eventName, handlerConfig);
    }

    public registerAllEmitHandlers(handlers: EmitHandler[]): void {
        handlers.forEach(handler => this.registerEmitHandler(handler));
    }

    public emit(eventName: string, data?: any): void {
        const emitHandler = this.emitHandlers.get(eventName);
        if(emitHandler) {
            emitHandler.emit(data);
        } else if(this.socket) {
            this.socket.emit(eventName, data);
        }
    }

    public registerAllEvents(emitEvent: (eventName: any, data: any) => void): void {
        this.eventHandlers.forEach((handlerConfig, eventName) => {
            if(this.socket && handlerConfig.autoRegister !== false) {
                this.socket.on(eventName, (data: any) => {
                    handlerConfig.handler(data);
                    emitEvent(eventName, data);
                });
            }
        });
    }
}