/*
-------------------

    ENTRY POINT
            
-------------------
*/

import { NextRequest } from 'next/server';
import { MessageServer } from './.server/server';
import { resBaseUrl } from './.api/routes';

const PORT = process.env.PORT || 3001;
const dummyReq = new NextRequest(`http://localhost:${PORT}`, {
    headers: {
        host: `localhost:${PORT}`,
        'x-forwarded-proto': 'http',
    }
});
const BASE_URL = resBaseUrl(dummyReq, PORT);

const server = new MessageServer(BASE_URL);
server.init(PORT);

console.log(`Server starting on port ${BASE_URL}!!! ;)`);