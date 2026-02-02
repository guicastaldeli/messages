//
//
// Update time from the api gateway
// to the Server interface.
//
//

window.addEventListener('load', async () => {
    try {
        await window.configReady;
                
        console.log('Configuration loaded, updating UI...');
                
        const apiStatus = document.getElementById('api-gateway-status');
        if(window.API_GATEWAY_URL) {
            apiStatus.textContent = 'Connected';
            apiStatus.style.color = 'green';
        } else {
            apiStatus.textContent = 'Disconnected';
            apiStatus.style.color = 'red';
        }
                
        const script = document.createElement('script');
        script.src = '/main/public/time-updater.js';
        script.onload = () => {
            console.log('Time updater loaded successfully');
            const timeElements = document.querySelectorAll('[data-auto-time-update]');
            timeElements.forEach(element => {
                const elementId = element.id;
                if(elementId) window.timeUpdater.startUpdating(elementId);
            });
        }
        script.onerror = (e) => {
            console.error('Failed to load time-updater.js:', e);
            document.getElementById('ms--time').innerHTML = 
                '<p>Time: <span style="color: red">Error loading time updater</span></p>';
        }
        document.head.appendChild(script);
                
    } catch (error) {
        console.error('Error loading configuration:', error);
        const apiStatus = document.getElementById('api-gateway-status');
        apiStatus.textContent = 'Error: ' + error.message;
        apiStatus.style.color = 'red';
    }
});