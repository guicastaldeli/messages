import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { ContentGetter } from '../content-getter';

export class Interface {
    private server: http.Server;
    private io: SocketIOServer;
    private port: number | string;
    private contentGetter: ContentGetter;
    private url: string;
    
    constructor(
        server: http.Server,
        io: SocketIOServer,
        port: number | string,
        url: string
    ) {
        this.server = server;
        this.io = io;
        this.port = port;
        this.url = url;
        this.contentGetter = new ContentGetter();
    }

    //Welcome Message
    private getWelMessage(): string {
        const content = this.contentGetter.__welcome();
        return content;
    }

    //Version
    private getVersion(): string {
        const content = this.contentGetter.__version();
        return content;
    }

    //Time
    private getTime(): string {
        const content = this.contentGetter.__time();
        return content;
    }
     
    //Status
    private getStatus(): string {
        const status = this.server.listening ? 'running' : 'stopped';
        const uptime = process.uptime();
        const connections = this.io.engine.clientsCount;
        const content = this.contentGetter.__status(status, uptime, connections); 
        return content;
    }

    //Routes
    private getRoutes(): string {
        const content = this.contentGetter.__route(this.url);
        return content;
    }

    public get(): string {
        const welcome = this.getWelMessage();
        const version = this.getVersion();
        const time = this.getTime();
        const status = this.getStatus();
        const routes = this.getRoutes();
        
        const content = `
            <div id="container">
                ${welcome}
                ${version}
                ${time}
                ${status}
                ${routes}
            </div>
        `;

        return content;
    }
}