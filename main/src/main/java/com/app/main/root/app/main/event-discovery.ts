export class EventDiscovery {
    private avaliableEvents: Set<string> = new Set();
    private url: string;

    constructor() {
        this.url = this.getUrl();
    }

    private getUrl(): string {
        if(typeof window === 'undefined') {
            const protocol = process.env.NODE_ENV === 'development' ? 'http:' : 'https:';
            const host = process.env.NEXT_PUBLIC_WS_HOST || 'localhost';
            const port = process.env.NEXT_PUBLIC_WS_PORT || '3001';
            const url = `${protocol}//${host}:${port}`; 
            return url;
        }
        const protocol = window.location.protocol === 'http:' ? 'http:' : 'https:';
        const host = process.env.NEXT_PUBLIC_WS_HOST || window.location.hostname;
        const port = process.env.NEXT_PUBLIC_WS_PORT || '3001';
        const url = `${protocol}//${host}:${port}`; 
        return url;
    }

    public async events(): Promise<void> {
        try {
            const url = `${this.url}/events`;
            console.log(url);
            
            const res = await fetch(url);
            if(!res.ok) throw new Error(`HTTP error!, ${res.status}`);

            const events: string[] = await res.json();
            this.avaliableEvents = new Set(events);
        } catch(err) {
            console.log(err);
        }
    }

    public isEventValiable(event: string): boolean {
        return this.avaliableEvents.has(event);
    }

    public getAvaliableEvents(): string[] {
        return Array.from(this.avaliableEvents);
    }
}