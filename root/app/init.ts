/*
-------------------

    ENTRY POINT
            
-------------------
*/

import { NextRequest } from 'next/server';
import { MessageServer } from './.server/server';
import { resBaseUrl } from './.api/routes';
import { TimeStream } from './.api/time-stream';

const PORT = process.env.PORT || 3001;
const baseReq = new NextRequest(`http://localhost:${PORT}`, {
    headers: {
        host: `localhost:${PORT}`,
        'x-forwarded-proto': 'http',
    }
});
const BASE_URL = resBaseUrl(baseReq, PORT);

//Time
const timeStream = new TimeStream();

//Init Server
const server = new MessageServer(BASE_URL, timeStream);
server.init(PORT);

console.log(`Server starting on port ${BASE_URL}!!! ;)`);