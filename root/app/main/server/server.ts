export class Server {
    private express = require('express');
    private path = require('path');
    private app = this.express();
    private server = require('http').createServer(this.app);
    public io = require('socket.io')(this.server);

    constructor() {
        this.useApp();
        this.configSocket();
    }

    private useApp(): void {
        this.app.use(this.express.static(this.path.join(__dirname + './public')));
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
            socket.on('new-user', (message: any) => {
                socket.broadcast.emit('update', message);
            });
        })
    }
}