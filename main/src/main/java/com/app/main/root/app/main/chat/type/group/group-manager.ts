import React, { use } from "react";
import { createRoot, Root } from "react-dom/client";
import { SocketClientConnect } from "@/app/main/socket-client-connect";
import { ChatController } from "../../chat-controller";
import { InviteCodeManager } from "./invite-code-manager";
import { ApiClientController } from "@/app/main/_api-client/api-client-controller";
import { GroupLayout } from "./group-layout";
import { chatState } from "../../chat-state-service";
import { Dashboard } from "@/app/main/_dashboard";
import { JoinGroupLayout } from "./join-group-form-layout";
import { ChatManager } from "../../chat-manager";

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
    private chatController: ChatController;
    private apiClientController: ApiClientController;
    public dashboard: Dashboard | null;
    private inviteCodeManager: InviteCodeManager;

    public appEl: HTMLDivElement | null = null;
    private layoutRef = React.createRef<GroupLayout>();
    public username: string;
    private socketId: string | null = null;
    public userId: string | null = null;
    
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
        chatController: ChatController,
        apiClientController: ApiClientController,
        dashboard: Dashboard | null,
        appEl: HTMLDivElement | null = null, 
        username: string
    ) {
        this.chatManager = chatManager;
        this.socketClient = socketClient;
        this.chatController = chatController;
        this.apiClientController = apiClientController;
        this.dashboard = dashboard;
        this.appEl = appEl;
        this.username = username;
        this.inviteCodeManager = new InviteCodeManager(socketClient, this);
    }

    public async getUserData(
        sessionId: string, 
        userId: string, 
        username: string
    ): Promise<void> {
        this.socketId = sessionId;
        this.userId = userId;
        this.username = username;
    }

    public setContainer(container: HTMLDivElement): void {
        this.container = container;
    }
    
    /**
     * 
     * Group Creation
     * 
     */
    private async handleGroupCreationScss(data: Data): Promise<void> {
        const time = new Date().toISOString();
        const name = this.currentGroupName;
        this.currentGroupName = data.name;
        this.currentGroupId = data.id;

        const lastMessageData = await this.chatManager.lastMessage(this.userId!, this.currentGroupId);
        const lastMessageContent = lastMessageData?.content || 'Group created';
        
        chatState.setType('GROUP');
        await this.chatController.setCurrentChat(
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
            lastMessage: lastMessageContent,
            lastMessageTime: time
        }

        const eventData = {
            ...data,
            id: data.id,
            groupId: data.id
        }

        /* Chat Event */
        const chatEvent = new CustomEvent('chat-item-added', { detail: chatItem });
        window.dispatchEvent(chatEvent);

        /* Activation Event */
        const chatActivationEvent = new CustomEvent('group-activated', { detail: eventData });
        window.dispatchEvent(chatActivationEvent);
        this.closeCreationForm();

        setTimeout(async () => {
            try {
                await this.chatController.loadHistory(this.currentGroupId, this.userId!, 0);
                console.log('Initial messages loaded for new group');
            } catch(err) {
                console.error('Failed to load initial messages:', err);
            }
        }, 50);

        if(this.onCreateSuccess) this.onCreateSuccess(data);
    }

    private closeCreationForm(): void {
        if(this.root) {
            setTimeout(() => {
                try {
                    this.root!.unmount();
                    this.root = null;
                    console.log('Creation form closed successfully');
                } catch(err) {
                    console.warn('Error unmounting creation form:', err);
                }
            }, 100);
        }
        
        if(this.dashboard) {
            this.dashboard.updateState({
                showCreationForm: false,
                showJoinForm: false,
                showGroup: true,
                hideGroup: false,
                groupName: this.currentGroupName
            });
        }
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
            chatController: this.chatController,
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

        if(this.dashboard) {
            this.dashboard.setState({ activeChat: null });
            
            if(this.root) {
                try {
                    this.root.unmount();
                } catch(err) {
                    console.warn('Safe unmount error (ignored):', err);
                }
                this.root = null;
            }
        }
        
        if(!this.container && this.dashboard?.chatContainerRef.current) {
            this.container = this.dashboard.chatContainerRef.current;
        }
        
        if(!this.container) {
            console.error('No container available for group creation menu');
            return;
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

        const data = {
            sessionId: this.socketId,
            creator: this.username,
            creatorId: this.userId,
            groupName: this.currentGroupName.trim()
        }

        return new Promise(async (res, rej) => {
            const sucssDestination = `/user/${this.socketId}/queue/group-creation-scss`;
            const errDestination = `/user/${this.socketId}/queue/group-creation-err`;
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

    /**
     * 
     * Join Group
     * 
     */
    private async handleGroupJoinScss(data: Data): Promise<void> {
        this.currentGroupName = data.name;
        const name = this.currentGroupName;
        const time = new Date().toISOString();
        this.currentGroupId = data.id;

        const lastMessage = await this.chatManager.lastMessage(this.userId!, this.currentGroupId);
        chatState.setType('GROUP');
        await this.chatController.setCurrentChat(
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

        /* Chat Event */
        const chatEvent = new CustomEvent('chat-item-added', { detail: chatItem });
        window.dispatchEvent(chatEvent);

        if(this.dashboard) {
            const currentChatList = this.dashboard.state.chatList || [];
            const chatExists = currentChatList.some((chat: any) => 
                chat.id === this.currentGroupId || chat.groupId === this.currentGroupId
            );
            
            if(!chatExists) {
                const updatedChatList = [...currentChatList, chatItem];
                this.dashboard.updateChatList(updatedChatList);
            }
        }

        /* Activated Event */
        const chatActivationEvent = new CustomEvent('group-activated', { detail: data }); 
        window.dispatchEvent(chatActivationEvent);

        setTimeout(async () => {
            try {
                await this.chatController.loadHistory(this.currentGroupId, this.userId!, 0);
                console.log('Initial messages loaded for joined group');
            } catch(err) {
                console.error('Failed to load initial messages:', err);
            }
        }, 50);

        if(this.onJoinSuccess) this.onJoinSuccess(data);
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
            chatController: this.chatController,
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
            try {
                this.root.unmount();
            } catch(err) {
                console.warn('Safe unmount error (ignored):', err);
            }
            this.root = null;
        }
        
        if(!this.container && this.dashboard?.chatContainerRef.current) {
            this.container = this.dashboard.chatContainerRef.current;
        }
        
        if(!this.container) {
            console.error('No container available for join menu');
            return;
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
        
        const existingGroupLayout = document.querySelector('[data-group-layout]');
        if(existingGroupLayout) {
            console.log('GroupLayout already exists, skipping duplicate creation');
            return;
        }
        
        const content = React.createElement(GroupLayout, {
            chatController: this.chatController,
            groupManager: this,
            mode: 'join'
        });

        this.root = createRoot(this.container);
        

        this.container.setAttribute('data-group-layout', 'true');
        
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
        this.chatController.setCurrentChat(
            data.id,
            'GROUP',
            data.members || [this.userId]
        );
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

    /**
     * 
     * Exit Group
     * 
     */
    private async handleGroupExitScss(data: any): Promise<void> {
        const exitedGroupId = data.id;
        console.log('handleGroupExitScss called for group:', exitedGroupId);
        
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
        console.log('Dispatching chat-item-removed event');
        window.dispatchEvent(removeEvent);

        const exitEvent = new CustomEvent('group-exit-complete', { detail: data });
        window.dispatchEvent(exitEvent);

        try {
            const cacheService = await this.chatController.chatService.getCacheServiceClient();
            cacheService.clearChatCache(exitedGroupId);
            console.log(`Cleared cache for exited group: ${exitedGroupId}`);
        } catch(err) {
            console.error(`Failed to clear cache for ${exitedGroupId}:`, err);
        }

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
        if(!targetGroupId) throw new Error('NO group selected to exit!');

        return new Promise(async (res, rej) => {
            const client = this.socketId;
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
                console.log(data)
                console.log('CLIENT', client)

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

    /**
     * 
     * Get Group Members
     * 
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

    /**
     * 
     * Add User to Group
     * 
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

    /**
     * 
     * Remove User to Group
     * 
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

    /**
     * Group Info
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
    
    /**
     * Group Actions
     */
    public onCreateGroup = () => {
        this.showCreationMenu();
    }

    public onJoinGroup = () => {
        this.showJoinMenu();
    }

    /**
     * Get Contact Details
     */
    private async getContactDetails(id: string): Promise<any> {
        const contacts = await this.dashboard?.contactService?.getContacts();
        return contacts?.find((c: any) => c.id === id);
    }

    /**
     * Get Invite Code Manager
     */
    public getInviteCodeManager(): InviteCodeManager {
        return this.inviteCodeManager;
    }
}