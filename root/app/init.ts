/*
------------------------------------

            ENTRY POINT
            
------------------------------------
*/

import { MessageServer } from './.server/server';

const server = new MessageServer();
const app = server.getApp();
const PORT = process.env.PORT || 3001;

app.get('/.api/route', (req, res) => {
    const host = req.hostname;
    const url = `http://${host}:${PORT}`;
    res.json({ url: url });
});

server.init(PORT);
console.log(`Server starting on port ${PORT}!! ;)`);