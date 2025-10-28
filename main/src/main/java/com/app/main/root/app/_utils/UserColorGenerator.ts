export class UserColorGenerator {
    private static readonly COLOR_PALETTE = [
        { name: 'red', value: '#FF6B6B' },
        { name: 'green', value: '#4ECDC4' },
        { name: 'blue', value: '#45B7D1' },
        { name: 'yellow', value: '#FFEAA7' },
        { name: 'purple', value: '#DDA0DD' },
        { name: 'cyan', value: '#96CEB4' },
        { name: 'orange', value: '#F7DC6F' },
        { name: 'pink', value: '#BB8FCE' },
        { name: 'teal', value: '#85C1E9' },
        { name: 'lime', value: '#F8C471' },
        { name: 'softRed', value: '#F5B7B1' },
        { name: 'softGreen', value: '#D5F5E3' },
        { name: 'softBlue', value: '#D6EAF8' },
        { name: 'softYellow', value: '#FCF3CF' },
        { name: 'softPurple', value: '#E8DAEF' }
    ];

    private static userColors = new Map<string, Map<string, { value: string; name: string }>>();

    /*
    ** Get User Color
    */
    public static getUserColorForGroup(groupId: string, userId: string): { value: string; name: string } {
        if(!this.userColors.has(groupId)) this.userColors.set(groupId, new Map());
        const colors = this.userColors.get(groupId);
        if(!colors) throw new Error('Color error');
    
        if(!colors.has(userId)) {
            const hash = this.hashString(userId + groupId);
            const colorIndex = Math.abs(hash) % this.COLOR_PALETTE.length;
            colors.set(userId, this.COLOR_PALETTE[colorIndex]);
        }
        return colors.get(userId)!;
    }

    /*
    ** Remove User Color
    */
    public static removeUserColorFromGroup(groupId: string, userId: string): void {
        const colors = this.userColors.get(groupId);
        if(colors) colors.delete(userId);
    }

    /*
    ** Get Color
    */
    public static getColor(name: string): { value: string; name: string } | undefined {
        return this.COLOR_PALETTE.find(color =>
            color.name.toLowerCase() === name.toLowerCase()
        );
    }

    private static hashString(str: string): number {
        let hash = 0;
        for(let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash;
    }
}