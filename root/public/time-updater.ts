class TimeUpdater {
    private updateIntervals: Map<string, number>;

    constructor() {
        this.updateIntervals = new Map<string, number>();
    }

    async fetchServerTime(): Promise<{
        local: string,
        serverTime: boolean
    }> {
        try {
            const res = await fetch('/.api/time-stream?_=' + Date.now());
            if(!res.ok) throw new Error('Time API not avaliable!');
            return await res.json();
        } catch(err) {
            return {
                local: new Date().toLocaleString(),
                serverTime: false
            }
        }
    }

    public startUpdating(elementId: string, prefix: string = 'Time: ') {
        const element = document.getElementById(elementId);
        if(!element) return;

        const update = async () => {
            const timeData = await this.fetchServerTime();
            element.textContent = prefix + timeData.local;
            element.setAttribute('data-time-source', timeData.serverTime ? 'server' : 'client');
        }
        update();

        const intervalId = window.setInterval(update, 1000);
        this.updateIntervals.set(elementId, intervalId);
        return () => this.stopUpdating(elementId);
    }

    public stopUpdating(elementId: string) {
        const intervalId = this.updateIntervals.get(elementId);
        if(intervalId) {
            clearInterval(intervalId);
            this.updateIntervals.delete(elementId);
        }
    }

    public stopAll() {
        this.updateIntervals.forEach(intervalId => clearInterval(intervalId));
        this.updateIntervals.clear();
    }
}

window.timeUpdater = new TimeUpdater();
document.addEventListener('DOMContentLoaded', () => {
    const timeElements = document.querySelectorAll('[data-auto-time-update]');
    timeElements.forEach(element => {
        const elementId = element.id;
        const prefix = element.getAttribute('data-time-prefix') || 'Time: ';
        if(elementId) window.timeUpdater.startUpdating(elementId, prefix);
    });
});