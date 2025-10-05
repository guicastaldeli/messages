export class EventDiscovery {
    public availableEvents: Set<string> = new Set();
    private url: string;
    private lastFetchTime: number = 0;
    private cacheDurarion: number = 3000;

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

    public async events(forceRefresh: boolean = false): Promise<void> {
        try {
            const now = Date.now();
            if(
                !forceRefresh && 
                (now - this.lastFetchTime) < this.cacheDurarion && 
                this.availableEvents.size > 0
            ) {
                return;
            }

            const url = `${this.url}/events`;
            const res = await fetch(url);
            if(!res.ok) throw new Error(`HTTP error!, ${res.status}`);
            const events: string[] = await res.json();
            this.availableEvents = new Set(events);
            this.lastFetchTime = now;

            console.log(Array.from(this.availableEvents))
        } catch(err) {
            console.log(err);
        }
    }

    public isEventValiable(event: string): boolean {
        return this.availableEvents.has(event);
    }

    public async isEventAvailable(event: string): Promise<boolean> {
        await this.events();
        return this.isEventValiable(event);
    }

    public getAvailableEvents(): string[] {
        return Array.from(this.availableEvents);
    }
}