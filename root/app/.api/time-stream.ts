export class TimeStream {
    private url: string;

    constructor(url: string = '') {
        this.url = url;
    }

    public async fetchServerTime(): Promise<{
        timestamp: number;
        iso: string;
        local: string;
        timezone: string;
        serverTime: boolean;
    }> {
        try {
            const res = await fetch(`${this.url}/.api/time-stream?_=${Date.now()}`);
            if(!res.ok) throw new Error('Time API not avaliable!');
            return await res.json();
        } catch(err) {
            const now = new Date();
            return {
                timestamp: now.getTime(),
                iso: now.toISOString(),
                local: now.toLocaleString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                serverTime: false
            }
        }
    }

    public async getFormattedTime(): Promise<string> {
        const timeData = await this.fetchServerTime();
        return timeData.local;
    }

    public startTimeUpdates(
        updateCallback: (time: string, isServerTime: boolean) => void,
        interval: number = 1000
    ): () => void {
        let isRunning = true;

        const updateTime = async () => {
            if(!isRunning) return;

            try {
                const timeData = await this.fetchServerTime();
                updateCallback(timeData.local, timeData.serverTime);
            } catch(err) {
                console.warn('Time update failed', err);
            }
        }

        updateTime();
        const intervalId = setInterval(updateTime, interval);
        return () => {
            isRunning = false;
            clearInterval(intervalId);
        }
    }

    public async getTimeWithTimezone(): Promise<{
        time: string;
        timezone: string;
        isServerTime: boolean;
    }> {
        const timeData = await this.fetchServerTime();
        return {
            time: timeData.local,
            timezone: timeData.timezone,
            isServerTime: timeData.serverTime
        }
    }

    public formatTimeDifference(timestamp: number): string {
        const diff = Date.now() - timestamp;
        const seconds = Math.floor(diff / 1000);

        //Differences
        const secsDiff = `${seconds} seconds ago`;
        const minDiff =  `${Math.floor(seconds / 60)} minutes ago`;
        const hourDiff = `${Math.floor(seconds / 3600)} hours ago`;
        const dayDiff  = `${Math.floor(seconds / 86400)} days ago.`;

        if(seconds < 60) return secsDiff;
        if(seconds < 3600) return minDiff;
        if(seconds < 86400) return hourDiff;
        return dayDiff;
    }
}