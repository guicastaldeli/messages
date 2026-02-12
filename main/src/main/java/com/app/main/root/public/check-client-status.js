async function checkClientStatus() {
    const statusElement = document.getElementById('client-status');
    if(!statusElement) return;

    try {
        if(window.configReady) {
            await window.configReady;
        }

        if(!window.WEB_URL) {
            statusElement.textContent = 'Waiting...';
            statusElement.style.color = 'orange';
            return;
        }

        const res = await fetch(window.WEB_URL, {
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-cache'
        });

        statusElement.textContent = 'Online';
        statusElement.style.color = 'green';
    } catch (error) {
        statusElement.textContent = 'Offline';
        statusElement.style.color = 'red';
    }
}

window.addEventListener('load', function() {
    setTimeout(() => {
        checkClientStatus();
        setInterval(checkClientStatus, 5000);
    }, 500);
});