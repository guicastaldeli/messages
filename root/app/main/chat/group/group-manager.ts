import React from "react";
import { createRoot, Root } from "react-dom/client";
import { SocketClient } from "@/app/.server/socket-client";
import { MessageManager } from "../../message-manager";
import { GroupLayout } from "./group-layout";
import { Sessions, SessionManager } from "../../session-manager";

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
    private sessionManager: SessionManager;

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
        sessionManager: SessionManager,
        appEl: HTMLDivElement | null = null, 
        uname: any
    ) {
        this.socketClient = socketClient;
        this.messageManager = messageManager;
        this.sessionManager = sessionManager;
        this.appEl = appEl;
        this.uname = uname;
        this.setupSocketListeners();
    }

    private setSession(session: Sessions): void {
        this.sessionManager.setSession(session);
    }

    private setupSocketListeners(): void {
        //Success
        this.socketClient.socketEmitter.registerEventHandler({
            eventName: 'group-created-scss',
            handler: (data: CreationData) => {
                this.currentGroupName = data.name;
                this.currentGroupId = data.id;
                console.log('sucss!', data);
                if(this.onCreateSuccess) this.onCreateSuccess(data)
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
        this.container.innerHTML = '';

        this.onCreateSuccess = onCreateSuccess;
        this.onCreateError = onCreateError;

        this.root = createRoot(this.container);
        const content = React.createElement(GroupLayout, {
            ref: this.layoutRef,
            messageManager: this.messageManager,
            groupManager: this
        });
        this.root.render(content);
    }

    public setContainer(container: HTMLElement): void {
        this.container = container;
    }

    public showMenu(): void {
        if(!this.appEl) return;
        
        this.renderLayout(
            (data) => {
                this.setSession('chat');
            },
            (error) => {
                alert(`Failed to create group: ${error.message}`);
                this.setSession('groupForm');
            }
        );
        
        this.setSession('groupForm');
    }

    private showForm(): void {
        if(!this.appEl) return;

        const joinScreen = this.appEl.querySelector('.join-screen');
        const dashboard = this.appEl.querySelector('.main-dashboard');
        if(joinScreen) joinScreen.classList.remove('active');
        if(dashboard) dashboard.classList.remove('active');

        const info = this.appEl.querySelector('.group-info');
        if(info) info.classList.add('active');
    }

    private showChatScreen(groupName: string): void {
        if(!this.appEl) return;
        this.currentGroupName = groupName;

        //Info Form
        const infoForm = this.appEl.querySelector('.group-info');
        if(infoForm) infoForm.classList.remove('active');

        //Name Display
        const nameEl = this.appEl.querySelector('#group-name');
        if(nameEl) nameEl.textContent = this.currentGroupName;

        const event = new CustomEvent(
            'group-creation-complete', {
            detail: { groupName }
        });
        window.dispatchEvent(event);
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