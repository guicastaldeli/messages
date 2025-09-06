import React from "react";
import { createRoot, Root } from "react-dom/client";
import { SocketClient } from "@/app/.server/socket-client";
import { MessageManager } from "../../message-manager";
import { GroupLayout } from "./group-layout";

export class GroupManager {
    private socketClient: SocketClient;
    private messageManager: MessageManager;
    public appEl: HTMLDivElement | null = null;
    private currentGroupName: string = '';
    private uname: any;

    private root: Root | null = null;
    private container!: HTMLElement;

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
    }

    private renderLayout(): void {
        if(!this.container) return;
        this.container.innerHTML = '';

        this.root = createRoot(this.container);
        const content = React.createElement(GroupLayout, {
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
        
        this.renderLayout();
        const joinScreen = this.appEl.querySelector('.join-screen');
        const dashboard = this.appEl.querySelector('.main-dashboard');
        if(joinScreen) joinScreen.classList.remove('active');
        if(dashboard) dashboard.classList.remove('active');

        const info = this.appEl.querySelector('.group-info');
        if(info) info.classList.add('active'); 
    }

    private create(): void {
        if(!this.appEl) return;

        //Name Form Input
        const nameInput = this.appEl.querySelector<HTMLInputElement>('#group-info-name');
        if(!nameInput || !nameInput.value.trim()) throw new Error('err!!');
        this.currentGroupName = nameInput.value.trim();

        //Name Display
        const nameEl = this.appEl.querySelector('#group-name');
        if(nameEl) nameEl.textContent = this.currentGroupName;

        //Info Form
        const infoForm = this.appEl.querySelector('.group-info');
        if(infoForm) infoForm.classList.remove('active');

        //Emit
        this.socketClient.socketEmitter.emit('create-group', {
            creator: this.uname,
            creatorId: this.socketClient.getSocketId(),
            groupName: this.currentGroupName
        });
    }

    public handleCreate = (): void => {
        this.create();
    }
}