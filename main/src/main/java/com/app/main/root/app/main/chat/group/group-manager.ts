import React from "react";
import { createRoot, Root } from "react-dom/client";
import { SocketClientConnect } from "../../socket-client-connect";
import { MessageManager } from "../../_messages_config/message-manager";
import { InviteCodeManager } from "./invite-code-manager";
import { GroupLayout } from "./group-layout";
import { chatState } from "../../chat-state-service";
import { Dashboard } from "../../dashboard";

interface CreationData {
    id: string;
    name: string;
    creator: string;
    creatorId: string;
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
    
    private root: Root | null = null;
    private container!: HTMLElement;

    private currentGroupName: string = '';
    public currentGroupId: string = '';
    private onCreateSuccess?: (data: CreationData) => void;
    private onCreateError?: (error: any) => void;
    private creationRes?: (data: CreationData) => void;
    private creationRej?: (error: any) => void;

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
        this.setupSocketListeners();
        this.inviteCodeManager = new InviteCodeManager(socketClient);
    }

    public async setupSocketListeners(): Promise<void> {        
        //Success
        this.socketClient.onDestination('group-creation-scss', (data: CreationData) => {
            if(this.creationRes) {
                this.creationRes(data);
                this.creationRes = undefined;
                this.creationRej = undefined;
            }
            this.handleGroupCreationScss(data);
        });

        //Update
    }

    private handleGroupCreationScss(data: CreationData): void {
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

    private renderLayout(
        onCreateSuccess: (data: CreationData) => void,
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
            onError: onCreateError
        });
        if(!this.root) this.root = createRoot(this.container);
        this.root.render(content);
    }

    public setContainer(container: HTMLElement): void {
        this.container = container;
    }

    public showMenu(): void {
        if(!this.appEl) return;
        if(this.root) {
            this.root.unmount();
            this.root = null;
        }
        
        this.renderLayout(
            (data) => {
                this.dashboard.updateState({
                    showForm: false,
                    showChat: true,
                    hideChat: false,
                    groupName: data.name
                });
            },
            (error) => {
                alert(`Failed to create group: ${error.message}`);
                this.dashboard.updateState({
                    showForm: true,
                    showChat: false,
                    hideChat: false,
                    groupName: ''
                });
                this.socketClient.on('group-creation-err', (err: any) => {
                    if(this.creationRej) {
                        this.creationRej(new Error(err.error));
                        this.creationRes = undefined;
                        this.creationRej = undefined;
                    }
                });
            }
        );
        
        this.dashboard.updateState({
            showForm: true,
            showChat: false,
            hideChat: false,
            groupName: ''
        });
    }

    /*
    ** Create Group
    */
    private async create(groupName: string): Promise<CreationData> {
        if(!this.socketClient.getSocketId()) {
            console.error('Failed to get socket ID');
            throw new Error('Unable to establish connection');
        }
        if(!groupName.trim()) throw new Error('name invalid');

        await this.socketClient.eventDiscovery.refreshEvents();
        this.currentGroupName = groupName;
        chatState.setType('group');
        const creatorId = await this.socketClient.getSocketId();

        const data = {
            creator: this.uname,
            creatorId: creatorId,
            groupName: this.currentGroupName.trim()
        }

        return new Promise(async (res, rej) => {
            const sucssDestination = '/queue/group-creation-scss';
            const errDestination = '/queue/group-creation-err';

            /* Success */ 
            const handleSucss = (data: any) => {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                if(data && data.id) {
                    res(data as CreationData);
                } else {
                    rej(new Error('Inavlid response data'));
                }
            }

            /* Error */
            const handleErr = (err: any) => {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                rej(new Error(err.error || err.message || 'Group creation failed'));
            }

            try {
                await this.socketClient.onDestination(sucssDestination, handleSucss);
                await this.socketClient.onDestination(errDestination, handleErr);

                const sucss = await this.socketClient.sendToDestination(
                    '/app/create-group',
                    data,
                    sucssDestination
                );

                if(!sucss) {
                    this.socketClient.offDestination(sucssDestination, handleSucss);
                    this.socketClient.offDestination(errDestination, handleErr);
                    rej(new Error('Failed to send group creation request!'));
                }
            } catch(err) {
                this.socketClient.offDestination(sucssDestination, handleSucss);
                this.socketClient.offDestination(errDestination, handleErr);
                rej(err);
            }
        });
    }

    public manageCreate = (groupName: string): void => {
        this.create(groupName);
    }

    /*
    ** Join Group
    */
    public async join(id: string, inviteCode?: string): Promise<any> {
        return new Promise(async (res, rej) => {
            const sucssDestination = '/queue/join-group-scss';
            const errDestination = '/queue/join-group-err';

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
                
                const data = {
                    groupId: id,
                    inviteCode: inviteCode,
                    username: this.uname
                }

                await this.socketClient.sendToDestination(
                    '/app/join-group',
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
    ** Group Info 
    */
    public async info(id: string): Promise<any> {
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
                const data = { groupId: id }

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