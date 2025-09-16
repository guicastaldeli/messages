import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { Interface } from './interface';
import { EventRegistry } from './event-registry';
import { configSocketEvents } from '../.data/socket-events';
import { colorConverter } from '../.utils/color-converter';

export class MessageServer {
    private static instance: MessageServer;
    private app: express.Application;
    private server: http.Server;
    private io: SocketIOServer;
    private port: number | string;
    private interface: Interface;

    constructor(url: string, timeStream: any) {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new SocketIOServer(this.server, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST']
            }
        });
        this.port = process.env.PORT || 3001;

        this.useApp();
        this.configRoutes();
        this.configSockets();
        this.interface = new Interface(
            this.server, 
            this.io, 
            this.port, 
            url,
            timeStream
        );
    }

    public static getInstance(url: string, timeStream: any): MessageServer {
        if(!MessageServer.instance) MessageServer.instance = new MessageServer(url, timeStream);
        return MessageServer.instance;
    }

    public init(port: number | string): void {
        this.server.listen(port, () => {
            console.log(`${colorConverter.style('Server running', ['cyan', 'bold'])}`);
        });
    }

    private useApp(): void {
        this.app.use(express.static(path.join(__dirname, '../../public')));
    }

    private async configRoutes(): Promise<void> {
        this.app.get('/', async (_, res) => {
            const content = await this.interface.get();
            res.send(content);
        });
    }

    private configSockets(): void {
        configSocketEvents();
        
        this.io.on('connection', (socket: any) => {
            console.log('connected', socket.id);
            socket.username = '';

            EventRegistry.getAllEvents().forEach(({ 
                eventName, 
                handler, 
                broadcast,
                broadcastSelf,
                targetEvent = eventName
            }) => {
                socket.on(eventName, async (data: any) => {
                    try {
                        const result = handler(socket, data, this.io);

                        if(broadcast) {
                            const emitEventName = targetEvent;

                            if(broadcastSelf) {
                                this.io.emit(emitEventName!, result);
                            } else {
                                socket.broadcast.emit(emitEventName, result);
                            }
                        }
                    } catch(err) {
                        console.log(err);
                        throw new Error('err');
                        
                    }
                });
            });
        });
    }

    //IO
    public getIO(): SocketIOServer {
        return this.io;
    }

    //App
    public getApp(): express.Application {
        return this.app;
    }
}