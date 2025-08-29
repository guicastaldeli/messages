import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { Interface } from './interface';

export class MessageServer {
    private app: express.Application;
    private server: http.Server;
    private io: SocketIOServer;
    private port: number | string;
    private interface: Interface;

    constructor(url: string) {
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
        this.interface = new Interface(this.server, this.io, this.port, url);
    }

    public init(port: number | string): void {
        this.server.listen(port, () => {
            console.log(`Server running`);
        });
    }

    private useApp(): void {
        this.app.use(express.static(path.join(__dirname + '../public')));
    }

    private configRoutes(): void {
        this.app.get('/', async (_, res) => {
            const content = this.interface.get();
            res.send(content);
        });
    }

    private configSockets(): void {
        this.io.on('connection', (socket: any) => {
            console.log('connected', socket.io);

            //New User
            socket.on('new-user', (username: any) => {
                socket.broadcast.emit('update', username + ' joined the chat!');
            });
            //Exiting User
            socket.on('exit-user', (username: any) => {
                socket.broadcast.emit('update', username + ' left the chat!');
            });
            //Chat
            socket.on('chat', (message: any) => {
                socket.broadcast.emit('chat', message);
            });
            //Disconnect
            socket.on('disconnect', () => {
                console.log('User disconnected', socket.id);
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