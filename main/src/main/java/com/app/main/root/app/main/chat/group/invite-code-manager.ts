import { SocketClientConnect } from "../../socket-client-connect";

export class InviteCodeManager {
    private socketClient: SocketClientConnect;

    constructor(socketClient: SocketClientConnect) {
        this.socketClient = socketClient;
    }

    /*
    ** Generate
    */
    public async generate(groupId: string): Promise<string> {
        return new Promise(async (res, rej) => {
            const sucssDestination = '/queue/invite-link-scss';
            const errDestination = '/queue/invite-link-err';

            const handleSucss = (data: any) => {
                this.success(
                    res, 
                    data, 
                    sucssDestination,
                    errDestination,
                    handleSucss,
                    handleErr
                );
            }

            const handleErr = (error: any) => {
                this.error(
                    rej,
                    error,
                    sucssDestination,
                    errDestination,
                    handleSucss,
                    handleErr
                );
            }

            try {
                await this.send(
                    sucssDestination,
                    errDestination,
                    handleSucss,
                    handleErr,
                    groupId,
                    rej
                );
            } catch(err) {
                rej(err);
            }
        });
    }

    /*
    ** Success
    */
    private success(
        res: any, 
        data: any, 
        sucssDest: string,
        errorDest: string, 
        sucssHandler: any, 
        errHandler: any
    ): void {
        this.socketClient.offDestination(sucssDest, sucssHandler);
        this.socketClient.offDestination(errorDest, errHandler);
        res(data.inviteLink);
    }

    /*
    ** Error
    */
    private error(
        rej: any, 
        error: any, 
        sucssDest: string,
        errorDest: string,
        sucssHandler: any, 
        errHandler: any
    ): void {
        this.socketClient.offDestination(sucssDest, sucssHandler);
        this.socketClient.offDestination(errorDest, errHandler);
        rej(new Error(error.message));
    }

    /*
    ** Send
    */
    private async send(
        sucssDest: string,
        errorDest: string,
        sucssHandler: any, 
        errHandler: any,
        id: any,
        rej: any
    ): Promise<void> {
        try {
            await this.socketClient.onDestination(sucssDest, sucssHandler);
            await this.socketClient.onDestination(errorDest, errHandler);
            const userId = await this.socketClient.getSocketId();
            const reqData = {
                userId: userId,
                groupId: id 
            }

            await this.socketClient.sendToDestination(
                '/app/generate-invite-link',
                reqData,
                sucssDest
            );
        } catch(err) {
            this.socketClient.offDestination(sucssDest, sucssHandler);
            this.socketClient.offDestination(errorDest, errHandler);
            rej(err)
        }
    }
}