import { Socket } from 'socket.io-client';
import { SocketClient } from '../.server/socket-client';
import { SocketEmitter, EventHandler, EmitHandler } from '../.server/socket-emitter';

export const configSocketClientEvents = (socketClient: SocketClient, socket: typeof Socket | null = null): void => {
    if(!socket) throw new Error('socket err');
    const socketEmitter = SocketEmitter.getInstance(socket);

    //Event Handler
    const eventHandlers: EventHandler[] = [
        {
            eventName: 'update',
            handler: (data: any) => {
                console.log('Update received:', data);
                socketClient.emitEvent('update', data);
            },
            autoRegister: true
        },
        {
            eventName: 'chat',
            handler: (data: any) => {
                socketClient.emitEvent('chat', data);
            },
            autoRegister: true
        },
        {
            eventName: 'new-message',
            handler: (data: any) => {
                console.log('new message received:', data);
                socketClient.emitEvent('new-message', data);
            },
            autoRegister: true
        },
        {
            eventName: 'group-message',
            handler: (data: any) => {
                console.log('group message received:', data);
                socketClient.emitEvent('group-message', data);
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
                socketEmitter.emit('new-user', username);
            }
        },
        {
            /* Exit User */
            eventName: 'exit-user',
            emit: (username: string) => {
                socketEmitter.emit('exit-user', username);
            }
        },
        {
            /* Chat */
            eventName: 'chat',
            emit: (username: string) => {
                socketEmitter.emit('chat', username);
            }
        },
        {
            /* New Message */
            eventName: 'new-message',
            emit: (data: string) => {
                socketEmitter.emit('new-message', data);
            }
        },
        {
            /* Group Message */
            eventName: 'group-message',
            emit: (data: string) => {
                socketEmitter.emit('group-message', data);
            }
        }
    ];

    socketClient.socketEmitter.registerAllEventHandlers(eventHandlers);
    socketClient.socketEmitter.registerAllEmitHandlers(emitHandlers);
    socketClient.socketEmitter.registerAllEvents(socketClient.emitEvent.bind(socketClient));
}