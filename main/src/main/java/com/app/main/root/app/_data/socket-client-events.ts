import { Socket } from 'socket.io-client';
import { SocketClient } from '../.server/socket-client';
import { SocketEmitter, EventHandler, EmitHandler } from '../.server/socket-emitter';
import { MessageTracker } from '../main/message-tracker';

export const configSocketClientEvents = (socketClient: SocketClient, socket: typeof Socket | null = null): void => {
    if(!socket) throw new Error('socket err');
    const socketEmitter = SocketEmitter.getInstance(socket);
    const messageTracker = MessageTracker.getInstance();

    //Event Handler
    const eventHandlers: EventHandler[] = [
        {
            eventName: 'update',
            handler: (data: any) => {
                messageTracker.trackMessage('update', data, 'received');
                socketClient.emitEvent('update', data);
            },
            autoRegister: true
        },
        {
            eventName: 'chat',
            handler: (data: any) => {
                messageTracker.trackMessage('update', data, 'received');
                socketClient.emitEvent('chat', data);
            },
            autoRegister: true
        }
    ];

    //Emit Handler
    const emitHandlers: EmitHandler[] = [
        {
            /* New User */
            eventName: 'new-user',
            emit: (username: string) => {
                messageTracker.trackMessage('new-user', username, 'sent', socket.id, username);
                socketEmitter.emit('new-user', username);
            }
        },
        {
            /* Exit User */
            eventName: 'exit-user',
            emit: (username: string) => {
                messageTracker.trackMessage('exit-user', username, 'sent', socket.id, username);
                socketEmitter.emit('exit-user', username);
            }
        },
        {
            /* Chat */
            eventName: 'chat',
            emit: (data: any) => {
                messageTracker.trackMessage('chat', data.content, 'sent', socket.id, data.username);
                socketEmitter.emit('chat', data);
            }
        }
    ];

    socketClient.socketEmitter.registerAllEventHandlers(eventHandlers);
    socketClient.socketEmitter.registerAllEmitHandlers(emitHandlers);
    socketClient.socketEmitter.registerAllEvents(socketClient.emitEvent.bind(socketClient));
}