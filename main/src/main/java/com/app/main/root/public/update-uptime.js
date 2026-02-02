//
//
// Update uptime of the Server
// to the interface.
//
//

function updateUptime() {
    fetch('/api/uptime')
        .then(response => response.text())
        .then(uptime => {
            document.getElementById('uptime-display').textContent = uptime;
        })
        .catch(error => {
            console.error('Error fetching uptime:', error);
        });
}

updateUptime();
setInterval(updateUptime, 1000);