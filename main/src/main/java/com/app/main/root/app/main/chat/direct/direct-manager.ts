export class DirectManager {
    public static generateChatId(senderId: string, targetUserId: string): string {
        const participants = [senderId, targetUserId].sort();
        return `direct_${participants.join('_')}_${Date.now()}`;
    }
}