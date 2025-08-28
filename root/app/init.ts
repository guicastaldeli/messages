/*
------------------------------------

            ENTRY POINT
            
------------------------------------
*/

import { MessageServer } from "./main/server/server";
import express from 'express';

const server = new MessageServer();
const PORT = process.env.PORT || 3001;
server.start(PORT);

const app = express();
app.get('/api/socket-url', (req, res) => {
    const host = req.hostname;
    res.json({ url: `http://${host}:${PORT}` });
});

console.log(`Server starting on port ${PORT}!! ;)`);