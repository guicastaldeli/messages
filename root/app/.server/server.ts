import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { Interface } from './interface';

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
            console.log(`Server running`);
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
        this.io.on('connection', (socket: any) => {
            console.log('connected', socket.id);
            let username = '';

            //New User
            socket.on('new-user', (user: any) => {
                username = user;
                socket.broadcast.emit(
                    'update', 
                    { data: username + ' joined!'}
                );
            });
            //Exiting User
            socket.on('exit-user', (user: any) => {
                username = user;
                socket.broadcast.emit(
                    'update', 
                    { data: username + ' left the chat!' }
                );
            });
            //Chat
            socket.on('chat', (content: any) => {
                const data = {
                    username: username,
                    content: content,
                    senderId: socket.id
                }
                this.io.emit('chat', data);
            });
            //Disconnect
            socket.on('disconnect', () => {
                if(username) socket.broadcast.emit(
                    'update', 
                    { data: username + ' left the chat!' }
                );
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