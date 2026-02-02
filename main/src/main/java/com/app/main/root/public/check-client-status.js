async function checkClientStatus() {
    const statusElement = document.getElementById('client-status');
    try {
        const res = await fetch(window.WEB_URL, {
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-cache'
        });
        if(res) {
            statusElement.textContent = 'Online';
            statusElement.style.color = 'green';
        }
    } catch (error) {
        statusElement.textContent = 'Offline';
        statusElement.style.color = 'red';
    }
}

checkClientStatus();
setInterval(checkClientStatus, 1000);