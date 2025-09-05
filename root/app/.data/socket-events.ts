import { EventRegistry, SocketEventHandler } from '../.server/event-registry';

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
            //Create Group
            eventName: 'create-group',
            handler: (socket, data, io) => {
                try {
                    if(!data.creator || !data.creatorId) throw new Error('Invalid group data!');

                    const creationDate = new Date().toISOString();
                    const format = Math.random().toString(36).substring(2, 9);
                    const id = `group_${Date.now()}_${format}`;

                    const newGroup = {
                        id: id,
                        name: data.name || `Group_${Date.now()}`,
                        creator: data.creator,
                        creatorId: data.creatorId,
                        members: [data.creatorId],
                        createdAt: creationDate
                    }
                    return newGroup;
                } catch(err) {
                    console.log(err);
                    throw new Error('err');
                }
            },
            broadcast: false,
            broadcastSelf: false,
            targetEvent: 'group-created-scss'
        },
        {
            //Join Group
            eventName: 'join-group',
            handler: (socket, data, io) => {
                const { groupId, username, userId } = data;
                return {
                    groupId,
                    username,
                    userId: socket.id,
                    message: `${username} joined`
                }
            },
            broadcast: true,
            broadcastSelf: true,
            targetEvent: 'group-created-scss'
        },
        {
            //Exit Group
            eventName: 'exit-group',
            handler: (socket, data, io) => {
                const { groupId, username } = data;
                return {
                    groupId,
                    username,
                    message: `${username} left`
                }
            },
            broadcast: true,
            broadcastSelf: false,
            targetEvent: 'group-update'
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