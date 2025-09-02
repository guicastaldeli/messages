export class ContentGetter {
    /*
    ----------------------

        SERVER CONTENT

    ----------------------
    */

    //Welcome Message
    __welcome() {
        const content = <p id="ms--wel">Welcome to Server! :)</p>;
        return content;
    }

    //Version
    __version() {
        const content = <p id="ms--version">Messages Server v1.0</p>;
        return content;
    }

    //Time
    __time(data: any) {
        const content =
        <p 
            id="ms--time" 
            data-auto-time-update
            data-server-time={data.serverTime}
        >
            Time: {data.local} {data.serverTime ? '(server)' : '(local)'}
        </p>;
        return content;
    }

    //Status
    __status( 
        status: string,
        uptime: number,
        connections: number 
    ) {
        const content =
        <div id="ms--status">
            <p>STATUS: {status}</p>
            <p>UPTIME: {uptime}</p>
            <p>CONNECTIONS: {connections}</p>
        </div>;
        return content;
    }

    //Route
    __route({ route }: { route: string }) {
        const content =
        <div id="ms--route">
            <p>ROUTE: {route}</p>
        </div>;
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

    /*
    -----------------------

        MESSAGES CONTENT

    -----------------------
    */

    //Self
    __self(message: any) {
        const content =
        <div>
            <div className="name">{message.username}</div>
            <div className="text">{message.text}</div>
        </div>
        return content;
    }

    //Other
    __other(message: any) {
        const content =
        <div>
            <div className="name">{message.username}</div>
            <div className="text">{message.text}</div>
        </div>;
        return content;
    }

    //Update
    __update(data: string) {
        const content = <div className="update">{data}</div>;
        return content;
    }

    //Message Content
    __messageContent(
        messageTypes: Record<string, (data: any) => React.ReactNode>,
        type: string,
        data: any
    ) {
        const content =
        <div className="message-content">
            {messageTypes[type](data)}
        </div>
        return content;
    }
}