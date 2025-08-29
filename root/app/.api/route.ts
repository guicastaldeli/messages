import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const host = req.headers.get('host') || 'localhost';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const port = process.env.PORT || 3001;

    const url = 
    process.env.NODE_ENV === 'production' ?
    `${protocol}://${host}` :
    `http://localhost:${port}`;

    return NextResponse.json({ url });
}