import React, { use } from "react";
import { createRoot, Root } from "react-dom/client";
import { SocketClientConnect } from "../../socket-client-connect";
import { MessageManager } from "../../_messages_config/message-manager";
import { InviteCodeManager } from "./invite-code-manager";
import { ApiClient } from "../../_api-client/api-client";
import { GroupLayout } from "./group-layout";
import { chatState } from "../../chat/chat-state-service";
import { Dashboard } from "../../_dashboard";
import { JoinGroupLayout } from "./join-group-form-layout";
import { ChatManager } from "../chat-manager";

interface Data {
    id: string;
    name: string;
    creator: string;
    creatorId: string;
    userId: string;
    sessionId: string;
    members: string[];
    createdAt: string;
}

export class GroupManager {
    private chatManager: ChatManager;
    public socketClient: SocketClientConnect;
    private messageManager: MessageManager;
    private apiClient: ApiClient;
    public dashboard: Dashboard | null;
    private inviteCodeManager: InviteCodeManager;

    public appEl: HTMLDivElement | null = null;
    private layoutRef = React.createRef<GroupLayout>();
    public username: string;
    private socketId: string | null = null;
    private userId: string | null = null;
    
    public root: Root | null = null;
    public container!: HTMLElement;

    public currentGroupName: string = '';
    public currentGroupId: string = '';

    private onCreateSuccess?: (data: Data) => void;
    private onCreateError?: (error: any) => void;
    private creationRes?: (data: Data) => void;
    private creationRej?: (error: any) => void;

    private onJoinSuccess?: (data: Data) => void;
    private onJoinError?: (error: any) => void;
    private joinRes?: (data: Data) => void;
    private joinRej?: (error: any) => void;

    private onExitSuccess?: (data: any) => void;
    private onExitError?: (error: any) => void;
    private exitRes?: (data: any) => void;
    private exitRej?: (data: any) => void;

    constructor(
        chatManager: ChatManager,
        socketClient: SocketClientConnect,
        messageManager: MessageManager,
        apiClient: ApiClient,
        dashboard: Dashboard | null,
        appEl: HTMLDivElement | null = null, 
        username: string
    ) {
        this.chatManager = chatManager;
        this.socketClient = socketClient;
        this.messageManager = messageManager;
        this.apiClient = apiClient;
        this.dashboard = dashboard;
        this.appEl = appEl;
        this.username = username;
        this.inviteCodeManager = new InviteCodeManager(socketClient);
    }

    public async getUserData(sessionId: string, userId: string, username: string): Promise<void> {
        this.socketId = sessionId;
        this.userId = userId;
        this.username = username;
    }
    
    /*
    **
    *** Group Creation
    **
    */
    private async handleGroupCreationScss(data: Data): Promise<void> {
        const time = new Date().toISOString();
        const name = this.currentGroupName;
        this.currentGroupName = data.name;
        this.currentGroupId = data.id;

        const lastMessage = await this.chatManager.lastMessage(this.currentGroupId);
        chatState.setType('GROUP');
        await this.messageManager.setCurrentChat(
            this.currentGroupId,
            'GROUP',
            data.members || [this.socketId]
        );

        const chatItem = {
            id: this.currentGroupId,
            chatId: this.currentGroupId,
            groupId: this.currentGroupId,
            name: name,
            type: 'GROUP',
            creator: data.creator,
            members: data.members,
            unreadCount: 0,
            lastMessage: lastMessage,
            lastMessageTime: time
        }

        const eventData = {
            ...data,
            id: data.id,
            groupId: data.id
        }

        //Chat Event
        const chatEvent = new CustomEvent('chat-item-added', { detail: chatItem });
        window.dispatchEvent(chatEvent);

        //Creation Complete Event
        const creationEvent = new CustomEvent('group-creation-complete', { detail: eventData }); 
        window.dispatchEvent(creationEvent);

        //Activation Event
        const chatActivationEvent = new CustomEvent('group-activated', { detail: eventData });
        window.dispatchEvent(chatActivationEvent);

        if(this.onCreateSuccess) this.onCreateSuccess(data);
    }

    private renderCreationLayout(
        onCreateSuccess: (data: Data) => void,
        onCreateError: (error: any) => void,
    ): void {
        if(!this.container) return;
        if(!this.dashboard) throw new Error('Dashboard error!');
        this.onCreateSuccess = onCreateSuccess;
        this.onCreateError = onCreateError;

        const content = React.createElement(GroupLayout, {
            ref: this.layoutRef,
            messageManager: this.messageManager,
            groupManager: this,
            onSuccess: onCreateSuccess,
            onError: onCreateError,
            mode: 'create'
        });

        if(!this.root) this.root = createRoot(this.container);
        this.root.render(content);
    }

    /* Creation Menu */
    public async showCreationMenu(): Promise<void> {
        if(!this.appEl) return;
        if(this.root) {
            this.root.unmount();
            this.root = null;
        }
        
        this.renderCreationLayout(
            (data) => {
                this.dashboard!.updateState({
                    showCreationForm: false,
                    showJoinForm: false,
                    showGroup: true,
                    hideGroup: false,
                    groupName: data.name
                });
            },
            (error) => {
                alert(`Failed to create group: ${error.message}`);
                this.dashboard!.updateState({
                    showCreationForm: true,
                    showJoinForm: false,
                    showGroup: false,
                    hideGroup: false,
                    groupName: ''
                });
            }
        );
        
        this.dashboard!.updateState({
            showCreationForm: true,
            showJoinForm: false,
            showGroup: false,
            hideGroup: false,
            groupName: ''
        });
    }

    /* Create Method */
    public async create(groupName: string): Promise<Data> {
        if(!this.socketId) {
            console.error('Failed to get socket ID');
            throw new Error('Unable to establish connection');
        }
        if(!groupName.trim()) throw new Error('name invalid');

        await this.socketClient.eventDiscovery.refreshEvents();
        this.currentGroupName = groupName;
        chatState.setType('GROUP');
        const sessionId = this.socketId;
        const userId = this.userId;
        console.log(userId)

        const data = {
            sessionId: sessionId,
            creator: this.username,
            creatorId: userId,
            groupName: this.currentGroupName.trim()
        }

        return new Promise(async (res, rej) => {
            const sucssDestination = `/user/${sessionId}/queue/group-creation-scss`;
            const errDestination = `/user/${sessionId}/queue/group-creation-err`;
            this.creationRes = res;
            this.creationRej = rej;

            /* Success */ 
            const handleSucss = async (data: any) => {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                if(data && data.id) {
                    if(this.creationRes) {
                        this.creationRes(data as Data);
                        this.creationRes = undefined;
                        this.creationRej = undefined;
                    }
                    await this.handleGroupCreationScss(data);
                }
            }

            /* Error */
            const handleErr = (err: any) => {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                if(this.creationRej) {
                    this.creationRej(new Error('Invalid response data'));
                    this.creationRes = undefined;
                    this.creationRej = undefined;
                }
            }

            try {
                await this.socketClient.onDestination(sucssDestination, handleSucss);
                await this.socketClient.onDestination(errDestination, handleErr);

                const sucss = await this.socketClient.sendToDestination(
                    '/app/create-group',
                    data,
                );

                if(!sucss) {
                    this.socketClient.offDestination(sucssDestination, handleSucss);
                    this.socketClient.offDestination(errDestination, handleErr);
                    if(this.creationRej) {
                        this.creationRej(new Error('Failed to send group creation'));
                        this.creationRes = undefined;
                        this.creationRej = undefined;
                    }
                }
            } catch(err) {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                if(this.creationRej) {
                    this.creationRej(err);
                    this.creationRes = undefined;
                    this.creationRej = undefined;
                }
            }
        });
    }

    /*
    **
    *** Join Group
    **
    */
    private async handleGroupJoinScss(data: Data): Promise<void> {
        this.currentGroupName = data.name;
        const name = this.currentGroupName;
        const time = new Date().toISOString();
        this.currentGroupId = data.id;

        const lastMessage = await this.chatManager.lastMessage(this.currentGroupId);
        chatState.setType('GROUP');
        await this.messageManager.setCurrentChat(
            data.id, 
            'GROUP', 
            data.members || [this.userId]
        );

        if(this.dashboard) {
            this.dashboard.updateState({
                showCreationForm: false,
                showJoinForm: false,
                showGroup: true,
                hideGroup: false,
                groupName: data.name
            });
        }

        const chatItem = {
            id: this.currentGroupId,
            chatId: this.currentGroupId,
            groupId: data.id,
            name: name,
            type: 'GROUP',
            creator: data.creator,
            members: data.members,
            unreadCount: 0,
            lastMessage: lastMessage,
            lastMessageTime: time
        }

        //Chat Event
        const chatEvent = new CustomEvent('chat-item-added', { detail: chatItem });
        window.dispatchEvent(chatEvent);

        //Activated Event
        const chatActivationEvent = new CustomEvent('chat-activated', { detail: data }); 
        window.dispatchEvent(chatActivationEvent);

        //Join Complete
        const joinEvent = new CustomEvent('group-join-complete', { detail: data });
        window.dispatchEvent(joinEvent);

        if (this.onJoinSuccess) this.onJoinSuccess(data);
    }

    private renderJoinLayout(
        onJoinSuccess: (data: Data) => void,
        onJoinError: (error: any) => void,
    ): void {
        if(!this.container) return;
        if(!this.dashboard) throw new Error('Dashboard error!');
        this.onJoinSuccess = onJoinSuccess;
        this.onJoinError = onJoinError;

        const content = React.createElement(JoinGroupLayout, {
            messageManager: this.messageManager,
            groupManager: this,
            onSuccess: onJoinSuccess,
            onError: onJoinError,
            mode: 'join'
        });

        if(!this.root) this.root = createRoot(this.container);
        this.root.render(content);
    }

    /* Join Menu */
    public showJoinMenu(): void {
        if(!this.appEl) return;
        if(this.root) {
            this.root.unmount();
            this.root = null;
        }
        
        this.renderJoinLayout(
            (data) => {
                this.renderGroupAfterJoin(data);
            },
            (error) => {
                alert(`Failed to join group: ${error.message}`);
                this.dashboard!.updateState({
                    showCreationForm: false,
                    showJoinForm: true,
                    showGroup: false,
                    hideGroup: false,
                    groupName: ''
                });
            }
        );
        
        this.dashboard!.updateState({
            showCreationForm: false,
            showJoinForm: true,
            showGroup: false,
            hideGroup: false,
            groupName: ''
        });
    }

    /* Render Group Join */
    private renderGroupAfterJoin(data: Data): void {
        if(!this.container) return;
        if(!this.dashboard) return;
        if(this.root) {
            this.root.unmount();
            this.root = null;
        }

        const content = React.createElement(GroupLayout, {
            messageManager: this.messageManager,
            groupManager: this,
            mode: 'join'
        });

        this.root = createRoot(this.container);
        this.root.render(content);
        this.currentGroupId = data.id;
        this.currentGroupName = data.name;

        this.dashboard.updateState({
            showCreationForm: false,
            showJoinForm: false,
            showGroup: true,
            hideGroup: false,
            groupName: data.name
        });
        this.messageManager.setCurrentChat(
            data.id,
            'GROUP',
            data.members || [this.userId]
        );

        const event = new CustomEvent('group-join-complete', { detail: data });
        window.dispatchEvent(event);
    }

    /* Join Method */
    public async join(inviteCode: string, id?: string): Promise<any> {
        return new Promise(async (res, rej) => {
            const client = this.userId;
            const sucssDestination = `/user/${client}/queue/join-group-scss`;
            const errDestination = `/user/${client}/queue/join-group-err`;
            this.joinRes = res;
            this.joinRej = rej;

            /* Success */
            const handleSucss = async (data: any) => {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                if(this.joinRes) {
                    this.joinRes(data);
                    this.joinRes = undefined;
                    this.joinRej = undefined;
                }
                await this.handleGroupJoinScss(data);
            }

            /* Error */
            const handleErr = (error: any) => {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                if(this.joinRej) {
                    this.joinRej(new Error(error.message));
                    this.joinRes = undefined;
                    this.joinRej = undefined;
                }
            }

            try {
                await this.socketClient.onDestination(sucssDestination, handleSucss);
                await this.socketClient.onDestination(errDestination, handleErr);
                const userId = this.userId;
                
                const data = {
                    userId: userId,
                    inviteCode: inviteCode,
                    username: this.username
                }

                await this.socketClient.sendToDestination(
                    '/app/join-group',
                    data
                );
            } catch(err) {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                if(this.joinRej) {
                    this.joinRej(err);
                    this.joinRes = undefined;
                    this.joinRej = undefined;
                }
            }
        });
    }

    /*
    **
    *** Exit Group
    **
    */
    private async handleGroupExitScss(data: any): Promise<void> {
        const exitedGroupId = data.id;
        if(this.currentGroupId === exitedGroupId) {
            this.currentGroupId = '';
            this.currentGroupName = '';
        }

        if(this.dashboard) {
            this.dashboard.updateState({
                showCreationForm: false,
                showJoinForm: false,
                showGroup: false,
                hideGroup: true,
                groupName: ''
            });
        }

        const removeEvent = new CustomEvent('chat-item-removed', {
            detail: {
                id: exitedGroupId,
                groupId: exitedGroupId,
                reason: 'group-exit'
            }
        });
        window.dispatchEvent(removeEvent);
        console.log(removeEvent)

        const exitEvent = new CustomEvent('group-exit-complete', { detail: data });
        window.dispatchEvent(exitEvent);

        if(this.root) {
            this.root.unmount();
            this.root = null;
        }
        if(this.onExitSuccess) {
            this.onExitSuccess(data);
        }
    }

    /* Exit Method */
    public async exitGroup(groupId?: string): Promise<any> {
        const targetGroupId = groupId || this.currentGroupId;
        console.log('groupId', groupId)
        console.log('currentGroupId', this.currentGroupId)
        if(!targetGroupId) throw new Error('NO group selected to exit!');

        return new Promise(async (res, rej) => {
            const client = this.socketId;
            console.log('EXITR GROUP CLIENT: ', client)
            if(!client) {
                rej(new Error('No socket connection'));
                return;
            }

            const sucssDestination = `/user/${client}/queue/exit-group-scss`;
            const errDestination = `/user/${client}/queue/exit-group-err`;
            this.exitRes = res;
            this.exitRej = rej;

            /* Success */
            const handleSucss = async (data: any) => {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                if(this.exitRes) {
                    this.exitRes(data);
                    this.exitRes = undefined;
                    this.exitRej = undefined;
                }
                await this.handleGroupExitScss(data);
            }

            /* Error */
            const handleErr = (error: any) => {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                if(this.exitRej) {
                    this.exitRej(new Error(error.message));
                    this.exitRes = undefined;
                    this.exitRej = undefined;
                }
            }

            try {
                await this.socketClient.onDestination(sucssDestination, handleSucss);
                await this.socketClient.onDestination(errDestination, handleErr);

                const data = {
                    userId: this.userId,
                    username: this.username,
                    groupId: targetGroupId,
                    groupName: this.currentGroupName
                }

                console.log('EXITR GROUP CLIENT: ', client)
                await this.socketClient.sendToDestination(
                    '/app/exit-group',
                    data
                );
            } catch(err) {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                if(this.exitRej) {
                    this.exitRej(err);
                    this.exitRes = undefined;
                    this.exitRej = undefined;
                }
            }
        });
    }

    /*
    ** Group Info 
    */
    public async info(code: string): Promise<any> {
        return new Promise(async (res, rej) => {
            const sucssDestination = '/queue/group-info-scss';
            const errDestination = '/queue/group-info-err';

            /* Success */
            const handleSucss = (data: any) => {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                res(data);
            }

            /* Error */
            const handleErr = (error: any) => {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                rej(new Error(error.message));
            }

            try {
                await this.socketClient.onDestination(sucssDestination, handleSucss);
                await this.socketClient.onDestination(errDestination, handleErr);
                const data = { inviteCode: code }

                await this.socketClient.sendToDestination(
                    '/app/get-group-info',
                    data,
                    sucssDestination
                );
            } catch(err) {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                rej(err);
            }
        });
    }

    /*
    **
    *** Get Group Members
    **
    */
    public async getGroupMembers(groupId: string): Promise<any[]> {
        return new Promise(async (res, rej) => {
            const sucssDestination = '/queue/group-members-scss';
            const errDestination = '/queue/group-members-err';

            /* Success */
            const handleSucss = (data: any) => {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.off(errDestination, handleErr);
                res(data.members || []);
            }

            /* Error */
            const handleErr = (error: any) => {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                rej(new Error(error.message));
            }

            try {
                await this.socketClient.onDestination(sucssDestination, handleSucss);
                await this.socketClient.onDestination(errDestination, handleErr);

                await this.socketClient.sendToDestination(
                    '/app/get-group-members',
                    { groupId },
                    sucssDestination
                );
            } catch(err) {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                rej(err);
            }
        });
    }

    /*
    **
    *** Add User to Group
    **
    */
    public async addUserToGroup(groupId: string, contactId: string): Promise<any[]> {
        return new Promise(async (res, rej) => {
            const sucssDestination = '/queue/add-user-group-scss';
            const errDestination = '/queue/add-user-group-err';

            /* Success */
            const handleSucss = (data: any) => {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.off(errDestination, handleErr);
                res(data);
            }

            /* Error */
            const handleErr = (error: any) => {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                rej(new Error(error.message));
            }

            try {
                await this.socketClient.onDestination(sucssDestination, handleSucss);
                await this.socketClient.onDestination(errDestination, handleErr);
                const contact = await this.getContactDetails(contactId);

                const data = {
                    groupId: groupId,
                    userId: contactId,
                    username: contact.username
                }

                await this.socketClient.sendToDestination(
                    '/app/add-user-group',
                    data,
                    sucssDestination
                );
            } catch(err) {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                rej(err);
            }
        });
    }

    /*
    **
    *** Remove User to Group
    **
    */
    public async removeUserFromGroup(
        groupId: string, 
        userId: string, 
        username: string
    ): Promise<any[]> {
        return new Promise(async (res, rej) => {
            const sucssDestination = '/queue/remove-user-group-scss';
            const errDestination = '/queue/remove-user-group-err';

            /* Success */
            const handleSucss = (data: any) => {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.off(errDestination, handleErr);
                res(data);
            }

            /* Error */
            const handleErr = (error: any) => {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                rej(new Error(error.message));
            }

            try {
                await this.socketClient.onDestination(sucssDestination, handleSucss);
                await this.socketClient.onDestination(errDestination, handleErr);

                const data = {
                    groupId: groupId,
                    userId: userId,
                    username: username
                }

                await this.socketClient.sendToDestination(
                    '/app/remove-user-group',
                    data,
                    sucssDestination
                );
            } catch(err) {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                rej(err);
            }
        });
    }

    private async getContactDetails(id: string): Promise<any> {
        const contacts = await this.dashboard?.contactService?.getContacts();
        return contacts?.find((c: any) => c.id === id);
    }

    /*
    ** Group Actions
    */
    public onCreateGroup = () => {
        this.showCreationMenu();
    }

    public onJoinGroup = () => {
        this.showJoinMenu();
    }

    /*
    ** Get Invite Code Manager
    */
    public getInviteCodeManager(): InviteCodeManager {
        return this.inviteCodeManager;
    }
}