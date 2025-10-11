export class TimeStreamClient {
    private baseUrl: string | undefined;

    constructor(url: string | undefined) {
        this.baseUrl = url;
    }

    public async getTime(): Promise<any[]> {
        const res = await fetch(`${this.baseUrl}/api/time-stream`);
        if(!res.ok) throw new Error('Failed to fetch time!');
        return res.json();
    }
}