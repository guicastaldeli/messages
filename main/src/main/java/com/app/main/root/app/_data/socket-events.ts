import { EventRegistry, SocketEventHandler } from '../.server/event-registry';
import { MessageTracker } from '../main/message-tracker';
import { dbService } from '../.db/db-service';
import { ConnectionTracker } from '../.server/connection-tracker';

export const configSocketEvents = (): void => {
    const messageTracker = MessageTracker.getInstance();
    const connectionTracker = ConnectionTracker.getInstance();
    
    const events: SocketEventHandler[] = [
        {
            /* New User */
            eventName: 'new-user',
            handler: async (socket, user) => {
                messageTracker.trackMessage('new-user', user, 'received', socket.id, user);
                connectionTracker.updateUsername(socket.id, user);

                try {
                    await dbService.usersConfig.addUser(socket.id, user);
                    const connectionInfo = connectionTracker.getConnection(socket.id);
                    if(connectionInfo) connectionTracker.logUsernameSet(connectionInfo, user);
                } catch(err) {
                    console.error('Failed to add user:', err);
                }

                socket.username = user;
                return { data: user + ' joined' }
            },
            broadcast: true,
            broadcastSelf: false,
            targetEvent: 'update'
        },
        {
            /* Exit User */
            eventName: 'exit-user',
            handler: (socket, user) => {
                messageTracker.trackMessage('exit-user', user, 'received', socket.id, user);
                socket.username = user;
                return { data: user + ' left' }
            },
            broadcast: true,
            broadcastSelf: false,
            targetEvent: 'update'
        },
        {
            /* Chat */
            eventName: 'chat',
            handler: (socket, data) => {
                messageTracker.trackMessage('chat', data, 'received', socket.id, socket.content);

                try {
                    dbService.messagesConfig.saveMessage({
                        chatId: data.chatId || socket.id,
                        senderId: socket.id,
                        content: data.content || socket.content
                    });
                } catch(err) {
                    console.error('Failed to save message:', err);
                }

                return {
                    username: socket.username,
                    content: data,
                    senderId: socket.id,
                    chatId: data.chatId || socket.id
                }
            },
            broadcast: true,
            broadcastSelf: true,
            targetEvent: 'chat'
        },
        {
            /* Create Group */
            eventName: 'create-group',
            handler: async (socket, data, io) => {
                try {
                    if(!data.creator || !data.creatorId) throw new Error('Invalid group data!');

                    const creationDate = new Date().toISOString();
                    const format = Math.random().toString(36).substring(2, 9);
                    const id = `group_${Date.now()}_${format}`;

                    const newGroup = {
                        id: id,
                        name: data.groupName,
                        creator: data.creator,
                        creatorId: data.creatorId,
                        members: [data.creatorId],
                        createdAt: creationDate
                    }

                    try {
                        await dbService.groupsConfig.createGroup({
                            id: id,
                            name: data.groupName,
                            creatorId: data.creatorId
                        });

                        await dbService.groupsConfig.addUserToGroup(id, data.creatorId);
                    } catch(err) {
                        console.error('Failed to save group:', err);
                    }

                    socket.emit('group-created-scss', newGroup);
                    socket.broadcast.emit('group-update', {
                        type: 'group-created',
                        groupName: data.groupName,
                        creator: data.creator
                    });
                    return newGroup;
                } catch(err) {
                    console.log(err);
                    throw err;
                }
            },
            broadcast: false,
            broadcastSelf: false,
            targetEvent: null
        },
        {
            /* Join Group */
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
            /* Exit Group */
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
            /* Disconnect */
            eventName: 'disconnect',
            handler: (socket) => {
                connectionTracker.trackDisconnection(socket);
            },
            broadcast: true,
            broadcastSelf: false,
            targetEvent: 'update'
        },
        {
            /* New Message */
            eventName: 'new-message',
            handler: (socket, data) => {
                return {
                    chatId: data.chatId,
                    content: data.content,
                    sender: socket.username,
                    senderId: socket.id,
                    timestamp: new Date().toISOString()
                }
            },
            broadcast: true,
            broadcastSelf: true,
            targetEvent: 'new-message'
        }
    ];

    EventRegistry.registerAllEvents(events);
}