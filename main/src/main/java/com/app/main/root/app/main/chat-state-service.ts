export type Type = 'DIRECT' | 'GROUP' | null;

class ChatStateService {
    private current: Type = null;
    private listeners: Array<(t: Type) => void> = [];

    public setType(t: Type): void {
        if(this.current === t) return;
        this.current = t;
        for(const l of this.listeners) l(t);
    }

    public getType(): Type {
        return this.current;
    }

    public subscribe(cb: (t: Type) => void) {
        this.listeners.push(cb);
        return () => {
            this.listeners = this.listeners.filter(x => x !== cb);
        }
    }
}

export const chatState = new ChatStateService();