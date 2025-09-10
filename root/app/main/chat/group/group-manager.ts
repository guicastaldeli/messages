import React from "react";
import { createRoot, Root } from "react-dom/client";
import { SocketClient } from "@/app/.server/socket-client";
import { MessageManager } from "../../message-manager";
import { GroupLayout } from "./group-layout";

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
        appEl: HTMLDivElement | null = null, 
        uname: any
    ) {
        this.socketClient = socketClient;
        this.messageManager = messageManager;
        this.appEl = appEl;
        this.uname = uname;
        this.setupSocketListeners();
    }

    //State Related
        private onStateChange?: (
            state: {
                showForm: boolean;
                showChat: boolean;
                groupName: string;
            }
        ) => void;

        private currentState = {
            showForm: false,
            showChat: false,
            groupName: ''
        }

        public setStateChange(callback: (state: any) => void): void {
            this.onStateChange = callback;
        }

        public updateState(newState: Partial<typeof this.currentState>): void {
            this.currentState = { ...this.currentState, ...newState }
            if(this.onStateChange) this.onStateChange(this.currentState);
        }
    //

    private setupSocketListeners(): void {
        //Success
        this.socketClient.socketEmitter.registerEventHandler({
            eventName: 'group-created-scss',
            handler: (data: CreationData) => {
                this.currentGroupName = data.name;
                const name = this.currentGroupName;
                this.currentGroupId = data.id;

                const chatItem = {
                    id: data.id,
                    name: data.name,
                    type: 'group',
                    creator: data.creator,
                    members: data.members,
                    unreadCount: 0
                }

                const chatEvent = new CustomEvent(
                    'chat-item-added',
                    { detail: chatItem }
                );
                window.dispatchEvent(chatEvent);

                if(this.onCreateSuccess) this.onCreateSuccess(data);

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
                this.updateState({
                    showForm: false,
                    showChat: true,
                    groupName: data.name
                });
            },
            (error) => {
                alert(`Failed to create group: ${error.message}`);
                this.updateState({
                    showForm: true,
                    showChat: false,
                    groupName: ''
                })
            }
        );
        
        this.updateState({
            showForm: true,
            showChat: false,
            groupName: ''
        });
    }

    private create(groupName: string): void {
        if(!groupName.trim()) throw new Error('name invalid');
        this.currentGroupName = groupName;

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
}