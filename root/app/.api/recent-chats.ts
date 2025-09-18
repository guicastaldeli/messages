import { NextResponse } from 'next/server';
import { dbService } from '../.db/db-service';

export async function GET(req: Request): Promise<NextResponse> {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || '';

    try {
        const chats = await dbService.messagesConfig.getRecentChats(userId);
        return NextResponse.json(chats);
    } catch(err) {
        return NextResponse.json({ error: 'Failed to load recent chats' }, { status: 500 });
    }
}