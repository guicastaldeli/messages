import React from "react";
import { createRoot, Root } from "react-dom/client";
import { SocketClientConnect } from "../../socket-client-connect";
import { MessageManager } from "../../_messages_config/message-manager";
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

    public appEl: HTMLDivElement | null = null;
    private layoutRef = React.createRef<GroupLayout>();
    private uname: any;
    
    private root: Root | null = null;
    private container!: HTMLElement;

    private currentGroupName: string = '';
    private currentGroupId: string = '';
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
    }

    public async setupSocketListeners(): Promise<void> {        
        //Success
        this.socketClient.on('group-creation-scss', (data: CreationData) => {
            if(this.creationRes) {
                this.creationRes(data);
                this.creationRes = undefined;
                this.creationRej = undefined;
            }
            this.handleGroupCreationScss(data);
        });

        //Error
        this.socketClient.on('group-creation-err', (err: any) => {
            if(this.creationRej) {
                this.creationRej(new Error(err.error));
                this.creationRes = undefined;
                this.creationRej = undefined;
            }
        });
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
            }
        );
        
        this.dashboard.updateState({
            showForm: true,
            showChat: false,
            hideChat: false,
            groupName: ''
        });
    }

    private async create(groupName: string): Promise<void> {
        if(!this.socketClient.getSocketId()) {
            console.error('Failed to get socket ID');
            throw new Error('Unable to establish connection');
        }
        if(!groupName.trim()) throw new Error('name invalid');

        await this.socketClient.eventDiscovery.refreshEvents();

        this.currentGroupName = groupName;
        chatState.setType('group');
        const creatorId = this.socketClient.getSocketId();

        //Emit
        await this.socketClient.send('create-group', {
            creator: this.uname,
            creatorId: '222',
            groupName: this.currentGroupName
        });
    }

    public manageCreate = (groupName: string): void => {
        this.create(groupName);
    }

    public exitChat(): void {
        this.socketClient.send('exit-chat', this.uname);
    }
}