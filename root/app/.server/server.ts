import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';

export class MessageServer {
    private app: express.Application;
    private server: http.Server;
    private io: SocketIOServer;
    private port: number | string;

    constructor() {
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
    }

    public init(PORT: number | string): void {
        this.server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
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
        this.app.get('/.api/route', (req, res) => {
            const host = req.hostname;
            const url = `http://${host}:${this.port}`;
            res.json({ url: url });
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