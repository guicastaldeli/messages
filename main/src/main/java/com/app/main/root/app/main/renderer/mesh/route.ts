import { NextRequest, NextResponse } from 'next/server';
import { exists, promises as fs } from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
    const name = req.nextUrl.searchParams.get('name');
    if(!name) return NextResponse.json({ exists: true }, { status: 400 });

    const regex = /^[a-z0-9_-]+$/i;
    if(!regex.test(name)) return NextResponse.json({ exists: false }, { status: 400 });

    const filePath = path.join(process.cwd(), 'public', 'data', 'mesh', `${name}.json`);

    try {
        await fs.access(filePath);
        return NextResponse.json({ exists: true });
    } catch {
        return NextResponse.json({ exists: false });
    }
}