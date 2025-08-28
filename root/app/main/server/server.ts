import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';

export class MessageServer {
    private app: express.Application;
    private server: http.Server;
    private io: SocketIOServer;

    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new SocketIOServer(this.server, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST']
            }
        });

        this.useApp();
        this.configRoutes();
        this.configSocket();
    }

    private useApp(): void {
        this.app.use(express.static(path.join(__dirname + '../public')));
    }

    private configRoutes(): void {
        this.app.get('/', (_, res) => {
            res.send('Welcome to Server! :)');
        });
        this.app.get('/status', (_, res) => {
            res.json({ status: 'OK', socketIO: 'enabled' });
        });
    }

    private configSocket(): void {
        this.io.on('connection', (socket: any) => {
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
                socket.broadcast.emit('update', message);
            });
        });
    }

    public start(port: string | number): void {
        this.server.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    }
}