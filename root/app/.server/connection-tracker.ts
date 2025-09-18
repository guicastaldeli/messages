import { Server as SocketIOServer } from 'socket.io';
import { Socket } from 'socket.io';
import { colorConverter } from '../.utils/color-converter';

export interface ConnectionInfo {
    socketId: string;
    username: string;
    ipAddress: string | string[];
    userAgent: string;
    connectedAt: Date;
    disconnectedAt?: Date;
    isConnected: boolean;
    room?: string;
    groups: string[];
}

export class ConnectionTracker {
    private static instance: ConnectionTracker;
    private connections: Map<string, ConnectionInfo> = new Map();
    private connectionCalbacks: Set<(info: ConnectionInfo) => void> = new Set();
    private disconnectionCallBacks: Set<(info: ConnectionInfo) => void> = new Set();

    public static getInstance(): ConnectionTracker {
        if(!ConnectionTracker.instance) ConnectionTracker.instance = new ConnectionTracker();
        return ConnectionTracker.instance;
    }

    public trackConnection(socket: Socket): void {
        const ipAddress = this.getClientIp(socket);
        const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';

        const connectionInfo: ConnectionInfo = {
            socketId: socket.id,
            username: 'Anonymous',
            ipAddress,
            userAgent,
            connectedAt: new Date(),
            isConnected: true,
            groups: []
        }
        this.connections.set(socket.id, connectionInfo);
        this.logConnection(connectionInfo);
        this.notifyConnectionCallbacks(connectionInfo);
    }

    public trackDisconnection(socket: Socket, reason: string = 'unknown'): void {
        const connectionInfo = this.connections.get(socket.id);
        if(connectionInfo) {
            connectionInfo.disconnectedAt = new Date();
            connectionInfo.isConnected = false;
            this.logDisconnection(connectionInfo, reason);
            this.notifyDisconnectionCallbacks(connectionInfo);
        }
    }

    public updateUsername(socketId: string, username: string): void {
        const connectionInfo = this.connections.get(socketId);
        if(connectionInfo) {
            connectionInfo.username = username;
            this.connections.set(socketId, connectionInfo);
        }
    }

    public getConnection(socketId: string): ConnectionInfo | undefined {
        return this.connections.get(socketId);
    }

    public getAllConnections(): ConnectionInfo[] {
        return Array.from(this.connections.values());
    }

    public getActiveConnections(): ConnectionInfo[] {
        return this.getAllConnections().filter(conn => conn.isConnected);
    }

    public getConnectionCount(): number {
        return this.connections.size;
    }

    public getActiveConnectionCount(): number {
        return this.getActiveConnections().length;
    }

    public onConnection(callback: (info: ConnectionInfo) => void): void {
        this.connectionCalbacks.add(callback);
    }

    public onDisconnection(callback: (info: ConnectionInfo) => void): void {
        this.disconnectionCallBacks.add(callback);
    }

    public removeConnectionCallback(callback: (info: ConnectionInfo) => void): void {
        this.connectionCalbacks.delete(callback);
    }

    public removeDisconnectionCallback(callback: (info: ConnectionInfo) => void): void {
        this.disconnectionCallBacks.delete(callback);
    }

    private getClientIp(socket: Socket): string | string[] {
        const get =
        socket.handshake.address ||
        socket.handshake.headers['x-forwarded-for'] ||
        socket.conn.remoteAddress ||
        'Unknown';

        return get;
    }

    /*
    ***
    **** LOGS
    ***
    */
    private logConnection(info: ConnectionInfo): void {
        const timestamp = new Date().toLocaleTimeString();
        const socket = colorConverter.style(`${info.socketId}`, ['blue', 'bold']);
        const ip = colorConverter.style(`${info.ipAddress}`, ['blue', 'bold']);
        const prefix = colorConverter.style(`${timestamp} - CONNECTED: `, ['green', 'italic']);
        const suffix = colorConverter.style(' from IP: ', ['green', 'italic']);
        console.log(prefix + socket + suffix + ip);
    }

    private logDisconnection(info: ConnectionInfo, reason: string): void {
        const timestamp = new Date().toLocaleTimeString();
        const duration = 
        info.disconnectedAt ?
        Math.round((info.disconnectedAt.getTime() - info.connectedAt.getTime()) / 1000) :
        0;

        const message = `${timestamp} - DISCONNECTED: (${info.socketId} after ${duration}s - Reason: ${reason})`;
        console.log(colorConverter.style(message, ['red', 'bold']));
    }

    /*
    ***
    **** NOTIFICATIONS
    ***
    */
    private notifyConnectionCallbacks(info: ConnectionInfo): void {
        this.connectionCalbacks.forEach(callback => {
            try {
                callback(info);
            } catch(err) {
                console.error('Error in connection callback:', err);
            }
        });
    }

    private notifyDisconnectionCallbacks(info: ConnectionInfo): void {
        this.disconnectionCallBacks.forEach(callback => {
            try {
                callback(info);
            } catch(err) {
                console.error('Error in disconnection callback:', err);
            }
        });
    }
}