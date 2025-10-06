class TimeUpdater {
    constructor() {
        this.updateIntervals = new Map();
        this.serverApiUrl = window.location.origin;
        this.apiGatewayUrl = API_GATEWAY_URL;
    }

    async fetchServerTime() {
        try {
            const res = await fetch(`${this.apiGatewayUrl}/api/time-stream`);
            if(res.ok) {
                const timeData = await res.json();
                return {
                    local: timeData.local || new Date().toLocaleString(),
                    serverTime: timeData.serverTime || false,
                    source: timeData.source || 'unknown'
                }
            }
        } catch(err) {
            return {
                local: new Date().toLocaleString(),
                serverTime: false,
                source: 'client-fallback'
            }
        }
    }

    async checkApiGatewayStatus() {
        try {
            const res = await fetch(`${this.apiGatewayUrl}/api/time-stream`);
            const statusEl = document.getElementById('api-gateway-status');
            if(statusEl) {
                if(res.ok) {
                    statusEl.textContent = 'Connected';
                    statusEl.style.color = 'green'
                } else {
                    statusEl.textContent = 'Disconnected';
                    statusEl.style.color = 'red';
                }
            }
        } catch(err) {
            const statusEl = document.getElementById('api-gateway-status');
            if(statusEl) {
                statusEl.textContent = 'Disconnected';
                statusEl.style.color = 'red';
            }
        }
    }

    startUpdating(elementId) {
        const element = document.getElementById(elementId);
        if(!element) return;

        const update = async () => {
            await this.checkApiGatewayStatus();
            const timeData = await this.fetchServerTime();
            const timeSpan = element.querySelector('span') || element;
            timeSpan.textContent = timeData.local;
            element.setAttribute('data-time-source', timeData.source);

            if(timeData.serverTime) {
                element.style.color = 'green';
            } else {
                element.style.color = 'red';
            }
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