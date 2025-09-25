class TimeUpdater {
    constructor() {
        this.updateIntervals = new Map();
    }

    async fetchServerTime() {
        return {
            local: new Date().toLocaleString(),
            serverTime: false
        }
    }

    startUpdating(elementId, prefix = 'Time: ') {
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

    stopUpdating(elementId) {
        const intervalId = this.updateIntervals.get(elementId);
        if(intervalId) {
            clearInterval(intervalId);
            this.updateIntervals.delete(elementId);
        }
    }

    stopAll() {
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