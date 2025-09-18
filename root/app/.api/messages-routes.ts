import { NextResponse } from 'next/server';
import { dbService } from '../.db/db-service';

export async function GET(req: Request): Promise<NextResponse> {
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');
    if(!chatId) return NextResponse.json({ error: 'chatId is required' }, { status: 400 });

    try {
        const messages = await dbService.messagesConfig.getMessagesByChatId(chatId);
        return NextResponse.json(messages);
    } catch(err) {
        return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
    }
}