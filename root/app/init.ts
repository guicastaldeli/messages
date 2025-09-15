/*
-------------------

    ENTRY POINT
            
-------------------
*/

import { NextRequest } from 'next/server';
import { MessageServer } from './.server/server';
import { resBaseUrl } from './.api/routes';
import { TimeStream } from './.api/time-stream';
import { dbService } from './.db/db-service';

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
const server = MessageServer.getInstance(BASE_URL, timeStream);
server.init(PORT);

dbService.alert();
console.log(`Server starting on port ${BASE_URL}!!! ;)`);