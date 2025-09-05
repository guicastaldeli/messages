import { SocketClient } from "@/app/.server/socket-client";

export class GroupManager {
    private socketClient: SocketClient;
    private appEl: HTMLDivElement | null = null;
    private currentGroupName: string = '';
    private uname: any;

    constructor(
        socketClient: SocketClient,
        appEl: HTMLDivElement | null = null, 
        uname: any
    ) {
        this.socketClient = socketClient;
        this.appEl = appEl;
        this.uname = uname;
    }

    public showMenu(): void {
        console.log('showMenu')
        if(!this.appEl) return;

        const joinScreen = this.appEl.querySelector('.join-screen');
        const dashboard = this.appEl.querySelector('.main-dashboard');
        if(joinScreen) joinScreen.classList.remove('active');
        if(dashboard) dashboard.classList.remove('active');

        const info = this.appEl.querySelector('.group-info');
        if(info) info.classList.add('active'); 
    }

    public create(): void {
        console.log('create')
        if(!this.appEl || this.uname) return;

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
}