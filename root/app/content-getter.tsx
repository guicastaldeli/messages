import { ReactElement } from 'react';
import * as ReactDOMServer from 'react-dom/server';

export class ContentGetter {
    /*
    ----------------------

        SERVER CONTENT

    ----------------------
    */

    //Welcome Message
    __welcome(): ReactElement {
        const content = <p id="ms--wel">Welcome to Server! :)</p>;
        return content;
    }

    //Version
    __version(): ReactElement {
        const content = <p id="ms--version">Messages Server v1.0</p>;
        return content;
    }

    //Time
    __time(data: any): ReactElement {
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
    ): ReactElement {
        const content =
        <div id="ms--status">
            <p>STATUS: {status}</p>
            <p>UPTIME: {uptime}</p>
            <p>CONNECTIONS: {connections}</p>
        </div>;
        return content;
    }

    //Route
    __route(route: string): ReactElement {
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

    //Final
    __final(
        welcome: React.ReactNode,
        version: React.ReactNode,
        time: React.ReactNode,
        status: React.ReactNode,
        routes: React.ReactNode
    ): string {
        const content = (
            <>
                <title>Server</title>
                <div id="container">
                    {welcome}
                    {version}
                    {time}
                    {status}
                    {routes}
                </div>
                <script type="module" src="/time-updater.js"></script>
            </>
        );
        return ReactDOMServer.renderToStaticMarkup(content);
    }

    /*
    -----------------------

        MESSAGES CONTENT

    -----------------------
    */

    //Self
    __self(message: any): ReactElement {
        const content = (
            <div className="message self-message">
                <div className="user">{message.username}</div>
                <div className="content">{message.content}</div>
            </div>
        );
        return content;
    }

    //Other
    __other(message: any): ReactElement {
        const content =
        <div className="message other-message">
            <div className="user">{message.username}</div>
            <div className="content">{message.content}</div>
        </div>;
        return content;
    }

    //Update
    __update(data: { data: string }): ReactElement {
        const content = <div className="update">{data.data}</div>;
        return content;
    }

    //Message Content
    __messageContent(
        messageTypes: Record<string, (data: any) => React.ReactNode>,
        type: string,
        data: any
    ): ReactElement {
        const messageData = messageTypes[type](data);
        const content = <div className="message-content">{messageData}</div>
        return content;
    }
}