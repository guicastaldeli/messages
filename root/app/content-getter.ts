export class ContentGetter {
    /*
    ----------------------

        SERVER CONTENT

    ----------------------
    */

    //Welcome
    public __welcome(): string {
        const content = `
            <p id="ms--wel">Welcome to Server! :)</p>
        `;
        return content;
    }
    
    //Version
    public __version(): string {
        const content = `
            <p id="ms--version">Messages Server v1.0</p>
        `;
        return content;
    }

    //Time
    public __time(): string {
        const now = new Date();
        const formattedTime = now.toLocaleString();

        const content = `
            <p id="ms--time" 
                data-auto-time-update 
                data-time-prefix="Time!: "
            >
                Time: ${formattedTime}
            </p>
        `;
        return content;
    }
    
    //Status
    public __status(status: string, uptime: number, connections: number): string {
        const content = `
            <div id="ms--status">
                <p>STATUS: ${status}</p>
                <p>UPTIME: ${uptime}</p>
                <p>CONNECTIONS: ${connections}</p>
            </div>
        `;
        return content;
    } 
    
    //Storage
        //Messages
        //Users
    //
    //Login
        //User
        //Password
    //

    //Route
    public __route(route: string): string {
        const content = `
            <div id="ms--route">
                <p>ROUTE: ${route}</p>
            </div>
        `
        return content;
    }

    /*
    -----------------------

        MESSAGES CONTENT

    -----------------------
    */

    public __my(message: any): string {
        const content = `
            <div>
                <div class="name">You</div>
                <div class="text">${message.text}</div>
            </div>
        `
        return content;
    }

    public __other(message: any): string {
        const content = `
            <div>
                <div class="name">${message.username}</div>
                <div class="text">${message.text}</div>
            </div>
        `;
        return content;
    }
}