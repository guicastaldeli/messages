import React from "react";
import { createRoot, Root } from "react-dom/client";
import { SocketClientConnect } from "../../socket-client-connect";
import { MessageManager } from "../../_messages_config/message-manager";
import { InviteCodeManager } from "./invite-code-manager";
import { ApiClient } from "../../_api-client/api-client";
import { GroupLayout } from "./group-layout";
import { chatState } from "../../chat-state-service";
import { Dashboard } from "../../dashboard";
import { JoinGroupLayout } from "./join-group-form-layout";

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
    public socketClient: SocketClientConnect;
    private messageManager: MessageManager;
    private apiClient: ApiClient;
    public dashboard: Dashboard | null;
    private inviteCodeManager: InviteCodeManager;

    public appEl: HTMLDivElement | null = null;
    private layoutRef = React.createRef<GroupLayout>();
    public uname: any;
    private socketId: string | null = null;
    
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

    constructor(
        socketClient: SocketClientConnect,
        messageManager: MessageManager,
        apiClient: ApiClient,
        dashboard: Dashboard | null,
        appEl: HTMLDivElement | null = null, 
        uname: any
    ) {
        this.socketClient = socketClient;
        this.messageManager = messageManager;
        this.apiClient = apiClient;
        this.dashboard = dashboard;
        this.appEl = appEl;
        this.uname = uname;
        this.inviteCodeManager = new InviteCodeManager(socketClient);
    }

    public async init(): Promise<void> {
        this.socketId = await this.socketClient.getSocketId();
    }

    /*
    ** Load History
    */
    private async loadHistory(groupId: string): Promise<void> {
        try {
            await this.waitForMessagesContainer();
            const service = await this.apiClient.getMessageService();
            const messages = await service.getMessagesByChatId(groupId);
            if(messages && Array.isArray(messages)) {
                console.log(`Loading ${messages.length} messages for group ${groupId}`);
                for(const message of messages) {
                    await this.messageManager.renderHistory(message);
                }
            } else {
                console.log('No messages found for group:', groupId);
            }
        } catch(err) {
            console.error('Failed to load messages: ', err);
        }
    }

    private async waitForMessagesContainer(): Promise<void> {
        return new Promise((res) => {
            const checkContainer = () => {
                const container = document.querySelector('.chat-screen .messages');
                if(container) {
                    res();
                } else {
                    setTimeout(checkContainer, 100);
                }
            }
            checkContainer();
        });
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
            type: 'group',
            creator: data.creator,
            members: data.members,
            unreadCount: 0,
            lastMessage: 'No messages yet!! :(',
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
        const client = this.socketId;

        const data = {
            sessionId: client,
            creator: this.uname,
            creatorId: client,
            groupName: this.currentGroupName.trim()
        }

        return new Promise(async (res, rej) => {
            const sucssDestination = `/user/${client}/queue/group-creation-scss`;
            const errDestination = `/user/${client}/queue/group-creation-err`;
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
    private handleJoinGroupScss(data: Data): void {
        this.currentGroupName = data.name;
        const name = this.currentGroupName;
        const time = new Date().toISOString();
        this.currentGroupId = data.id;
        chatState.setType('GROUP');
        this.messageManager.setCurrentChat(data.id, 'GROUP', data.members || [this.socketId]);

        if(this.dashboard) {
            this.dashboard.updateState({
                showCreationForm: false,
                showJoinForm: false,
                showGroup: true,
                hideGroup: false,
                groupName: data.name
            });
        }

        this.loadHistory(data.id);

        const chatItem = {
            id: this.currentGroupId,
            chatId: this.currentGroupId,
            groupId: data.id,
            name: name,
            type: 'GROUP',
            creator: data.creator,
            members: data.members,
            unreadCount: 0,
            lastMessage: 'No messages yet!! :(',
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
            data.members || [this.socketId]
        );

        const event = new CustomEvent('group-join-complete', { detail: data });
        window.dispatchEvent(event);
    }

    /* Join Method */
    public async join(inviteCode: string, id?: string): Promise<any> {
        return new Promise(async (res, rej) => {
            const client = this.socketId;
            const sucssDestination = `/user/${client}/queue/join-group-scss`;
            const errDestination = `/user/${client}/queue/join-group-err`;
            this.joinRes = res;
            this.joinRej = rej;

            /* Success */
            const handleSucss = (data: any) => {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                if(this.joinRes) {
                    this.joinRes(data);
                    this.joinRes = undefined;
                    this.joinRej = undefined;
                }
                this.handleJoinGroupScss(data);
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
                const userId = this.socketId;
                
                const data = {
                    userId: userId,
                    inviteCode: inviteCode,
                    username: this.uname
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