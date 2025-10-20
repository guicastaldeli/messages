import React from "react";
import { createRoot, Root } from "react-dom/client";
import { SocketClientConnect } from "../../socket-client-connect";
import { MessageManager } from "../../_messages_config/message-manager";
import { InviteCodeManager } from "./invite-code-manager";
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
    public dashboard: Dashboard;
    private inviteCodeManager: InviteCodeManager;

    public appEl: HTMLDivElement | null = null;
    private layoutRef = React.createRef<GroupLayout>();
    private uname: any;
    private socketId: Promise<string>;
    
    public root: Root | null = null;
    private container!: HTMLElement;

    private currentGroupName: string = '';
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
        dashboard: Dashboard,
        appEl: HTMLDivElement | null = null, 
        uname: any
    ) {
        this.socketClient = socketClient;
        this.messageManager = messageManager;
        this.dashboard = dashboard;
        this.appEl = appEl;
        this.uname = uname;
        this.inviteCodeManager = new InviteCodeManager(socketClient);
        this.socketId = this.socketClient.getSocketId();
    }
    
    /*
    **
    *** Group Creation
    **
    */
    private handleGroupCreationScss(data: Data): void {
        this.currentGroupName = data.name;
        const name = this.currentGroupName;
        const time = new Date().toISOString();
        this.currentGroupId = data.id;
        chatState.setType('group');

        const chatItem = {
            id: this.currentGroupId,
            groupId: data.id,
            name: data.name,
            type: 'group',
            creator: data.creator,
            members: data.members,
            unreadCount: 0,
            lastMessage: 'No messages yet!! :(',
            lastMessageTime: time
        }

        //Chat Event
        const chatEvent = new CustomEvent(
            'chat-item-added',
            { detail: chatItem }
        );
        window.dispatchEvent(chatEvent);

        if (this.onCreateSuccess) {
            this.onCreateSuccess(data);
        }

        const event = new CustomEvent( 
            'group-creation-complete', 
            { detail: { name } }
        ); 
        window.dispatchEvent(event);
    }

    private renderCreationLayout(
        onCreateSuccess: (data: Data) => void,
        onCreateError: (error: any) => void,
    ): void {
        if(!this.container) return;

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

    public setContainer(container: HTMLElement): void {
        this.container = container;
    }

    /* Creation Menu */
    public async showCreationMenu(): Promise<void> {
        const client = await this.socketId;
        if(!this.appEl) return;
        if(this.root) {
            this.root.unmount();
            this.root = null;
        }
        
        this.renderCreationLayout(
            (data) => {
                this.dashboard.updateState({
                    showCreationForm: false,
                    showJoinForm: false,
                    showGroup: true,
                    hideGroup: false,
                    groupName: data.name
                });
            },
            (error) => {
                alert(`Failed to create group: ${error.message}`);
                this.dashboard.updateState({
                    showCreationForm: true,
                    showJoinForm: false,
                    showGroup: false,
                    hideGroup: false,
                    groupName: ''
                });
            }
        );
        
        this.dashboard.updateState({
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
        chatState.setType('group');
        const client = await this.socketId;

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
            const handleSucss = (data: any) => {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                if(data && data.id) {
                    if(this.creationRes) {
                        this.creationRes(data as Data);
                        this.creationRes = undefined;
                        this.creationRej = undefined;
                    }
                    this.handleGroupCreationScss(data);
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
        chatState.setType('group');

        const chatItem = {
            id: this.currentGroupId,
            groupId: data.id,
            name: data.name,
            type: 'group',
            creator: data.creator,
            members: data.members,
            unreadCount: 0,
            lastMessage: 'No messages yet!! :(',
            lastMessageTime: time
        }

        //Chat Event
        const chatEvent = new CustomEvent(
            'chat-item-added',
            { detail: chatItem }
        );
        window.dispatchEvent(chatEvent);

        if (this.onJoinSuccess) {
            this.onJoinSuccess(data);
        }

        const event = new CustomEvent( 
            'chat-activated', 
            { detail: { name } }
        ); 
        window.dispatchEvent(event);
    }

    private renderJoinLayout(
        onJoinSuccess: (data: Data) => void,
        onJoinError: (error: any) => void,
    ): void {
        if(!this.container) return;

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
                this.dashboard.updateState({
                    showCreationForm: false,
                    showJoinForm: false,
                    showGroup: true,
                    hideGroup: false,
                    groupName: data.name
                });
            },
            (error) => {
                alert(`Failed to join group: ${error.message}`);
                this.dashboard.updateState({
                    showCreationForm: false,
                    showJoinForm: true,
                    showGroup: false,
                    hideGroup: false,
                    groupName: ''
                });
            }
        );
        
        this.dashboard.updateState({
            showCreationForm: false,
            showJoinForm: true,
            showGroup: false,
            hideGroup: false,
            groupName: ''
        });
    }

    /* Join Method */
    public async join(inviteCode: string, id?: string): Promise<any> {
        return new Promise(async (res, rej) => {
            const client = await this.socketId;
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
                const userId = await this.socketId;
                
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
    ** Get Invite Code Manager
    */
    public getInviteCodeManager(): InviteCodeManager {
        return this.inviteCodeManager;
    }
}