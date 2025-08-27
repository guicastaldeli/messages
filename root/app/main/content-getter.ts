export class ContentGetter {
    public __my(message: any): string {
        const content = `
            <div>
                <div class="name">You</div>
                <div class="text">${message.text}</div>
            </div>
        `
        return content;
    }

    public __other(message: any): string {
        const content = `
            <div>
                <div class="name">${message.username}</div>
                <div class="text">${message.text}</div>
            </div>
        `;
        return content;
    }
}