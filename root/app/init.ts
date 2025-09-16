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
import { colorConverter } from './.utils/color-converter';

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

function alert() {
    console.log(
        `${colorConverter.style('Server starting on port ', ['magenta', 'italic'])}` +
        `${colorConverter.style(`${BASE_URL}`, ['white', 'blink'])}` +
        `${colorConverter.style('!!! ;)', ['magenta', 'italic'])}`
    );
}

alert();
dbService.alert();