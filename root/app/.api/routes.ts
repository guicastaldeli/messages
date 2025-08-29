import { NextRequest, NextResponse } from 'next/server';

export function resBaseUrl(req: NextRequest, port: string | number): string {
    const host = req.headers.get('host') || 'localhost';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';

    const url = 
    process.env.NODE_ENV === 'production' ?
    `${protocol}://${host}` :
    `http://localhost:${port}`;

    return url;
}

export async function GET(req: NextRequest): Promise<any> {
    const port = process.env.PORT || 3001;
    const url = resBaseUrl(req, port);
    const res = NextResponse.json({ url });
    return res;
}