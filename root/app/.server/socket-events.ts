import { EventRegistry, SocketEventHandler } from './event-registry';

export const configSocketEvents = (): void => {
    const events: SocketEventHandler[] = [
        {
            //New User
            eventName: 'new-user',
            handler: (socket, user) => {
                socket.username = user;
                return { data: user + ' joined' }
            },
            broadcast: true,
            broadcastSelf: false,
            targetEvent: 'update'
        },
        {
            //Exit User
            eventName: 'exit-user',
            handler: (socket, user) => {
                socket.username = user;
                return { data: user + ' left' }
            },
            broadcast: true,
            broadcastSelf: false,
            targetEvent: 'update'
        },
        {
            //Chat
            eventName: 'chat',
            handler: (socket, content) => {
                return {
                    username: socket.username,
                    content: content,
                    senderId: socket.id
                }
            },
            broadcast: true,
            broadcastSelf: true,
            targetEvent: 'chat'
        },
        {
            //Disconnect
            eventName: 'disconnect',
            handler: (socket) => {
                return { data: socket.username + ' left' }
            },
            broadcast: true,
            broadcastSelf: false,
            targetEvent: 'update'
        },
    ];

    EventRegistry.registerAllEvents(events);
}