//
//
// Update Connections from client
// to the Server count.
//
//

function updateConnections() {
    fetch('/api/connection-tracker/connections/count/active')
        .then(response => response.text())
        .then(count => {
            document.getElementById('connections-display').textContent = count;
        })
        .catch(error => {
            console.error('Error fetching connections count:', error);
        });
}

updateConnections();
setInterval(updateConnections, 5000);