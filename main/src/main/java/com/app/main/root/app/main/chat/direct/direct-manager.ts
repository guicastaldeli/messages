export class DirectManager {
    public generateChatId(senderId: string, targetUserId: string): string {
        if(!targetUserId) {
            return `broadcast_${Date.now()}`;
        }
        const participants = [senderId, targetUserId].sort();
        return `direct_${participants.join('_')}`;
    }
}