import React from "react";
import { createRoot, Root } from "react-dom/client";
import { SocketClient } from "@/app/.server/socket-client";
import { MessageManager } from "../../message-manager";
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
    private socketClient: SocketClient;
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

    constructor(
        socketClient: SocketClient,
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

    private setupSocketListeners(): void {
        //Success
        this.socketClient.socketEmitter.registerEventHandler({
            eventName: 'group-created-scss',
            handler: (data: CreationData) => {
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

                if(this.onCreateSuccess) {
                    this.onCreateSuccess(data);
                }

                //Group Event
                const event = new CustomEvent( 
                    'group-creation-complete', 
                    { detail: { name } }
                ); 
                window.dispatchEvent(event);
            },
            autoRegister: true
        });

        //Error
        this.socketClient.socketEmitter.registerEventHandler({
            eventName: 'error',
            handler: (error) => {
                console.error(error);
                if(this.onCreateError) this.onCreateError(error);
            },
            autoRegister: true
        });
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
                })
            }
        );
        
        this.dashboard.updateState({
            showForm: true,
            showChat: false,
            hideChat: false,
            groupName: ''
        });
    }

    private create(groupName: string): void {
        if(!groupName.trim()) throw new Error('name invalid');
        this.currentGroupName = groupName;
        chatState.setType('group');

        //Emit
        this.socketClient.socketEmitter.emit('create-group', {
            creator: this.uname,
            creatorId: this.socketClient.getSocketId(),
            groupName: this.currentGroupName
        });
    }

    public manageCreate = (groupName: string): void => {
        this.create(groupName);
    }

    public exitChat(): void {
        this.socketClient.socketEmitter.emit('exit-chat', this.uname);
    }
}