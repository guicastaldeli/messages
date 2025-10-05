export class EventDiscovery {
    public availableEvents: Set<string> = new Set();
    private url: string;
    private lastFetchTime: number = 0;
    private cacheDurarion: number = 3000;
    private refreshCallbacks: ((events: string[]) => void)[] = [];

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

            const prevCount = this.availableEvents.size;
            this.availableEvents = new Set(events);
            this.lastFetchTime = now;
            if(this.availableEvents.size !== prevCount) this.notifyEventRefresh(events);

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

    /*
    ** Wait for Events
    */
    public async waitForEvent(
        events: string,
        timeout: number = 100000
    ): Promise<string> {
        return new Promise(async (res, rej) => {
            const startTime = Date.now();
            let resolve = false;

            const checkEvents = async () => {
                try {
                    if(resolve) return;

                    const currentTime = Date.now();
                    if(currentTime - startTime > timeout) {
                        rej(new Error(`Timeout: None of the events [${events}] available after ${timeout}ms`));
                        return;
                    }

                    await this.events(true);
                    for(const event of events) {
                        if(this.availableEvents.has(event)) {
                            console.log(`Event "${event}" is available`);
                            resolve = true;
                            res(event);
                            return;
                        }
                    }

                    setTimeout(checkEvents, 500);
                } catch(err) {
                    if(!res) rej(err);
                }
            }

            checkEvents();
        });
    }

    public async autoRefreshEvents(
        event: string,
        maxWaitTime: 10000
    ): Promise<boolean> {
        const startTime = Date.now();
        while(Date.now() - startTime < maxWaitTime) {
            await this.events(true);
            if(this.availableEvents.has(event)) return true;
            await new Promise(res => setTimeout(res, 500));
        }

        return false;
    }

    /*
    ** Force Refresh
    */
    public async refreshEvents(): Promise<void> {
        await this.events(true);
    }

    private notifyEventRefresh(events: string[]): void {
        this.refreshCallbacks.forEach(callback => {
            try {
                callback(events);
            } catch(err) {
                console.error(err);
            }
        });
    }
}