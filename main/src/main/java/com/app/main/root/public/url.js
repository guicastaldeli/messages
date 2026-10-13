// Environment Configuration
window.APP_ENV = 'prod';
window.LOAD_BALANCER_ENABLED = true;
window.SERVER_INSTANCES = ['server1:3003', 'server2:3004', 'server3:3005'];
window.HEALTH_CHECK_INTERVAL = 30000;
window.MAX_FAILURE_COUNT = 3;

// Encryption
window.ENCRYPTION_MASTER_KEY = 'x63uuphvQo1qCK4Y3kh2f77iRVwnUtXckI+eeUJgGng=';
window.RESET_TOKEN = 'F5h+fKbh04s/+nvJKOM1Av7b8JQ3KmBHCUjpWzoE1RE=';

// Web URLs
window.WEB_URL = 'http://localhost:3002';
window.NEXT_PUBLIC_WEB_URL = 'http://localhost:3002';

// Server Configuration
window.MAIN_SERVER_ID = 'xFGVJr+VaQSt9RHIBpNlazxAf';
window.DEFAULT_URL = 'http://localhost';
window.SERVER_URL = 'http://localhost:3003';
window.SERVER_ALT_URL = 'http://localhost:3003';

// Server HTTP Endpoints
window.SERVER_DEF_HTTP_URL = 'http://localhost:3003/main';
window.SERVER_DIR_HTTP_URL = 'http://localhost:3003/main/direct';

// Server WebSocket Endpoints
window.SERVER_DEF_WS_URL = 'ws://localhost:3003/main';
window.SERVER_DIR_WS_URL = 'ws://localhost:3003/main/direct';

// Public Server URLs
window.NEXT_PUBLIC_SERVER_ALT_URL = 'http://localhost:3003';
window.NEXT_PUBLIC_SERVER_DEF_HTTP_URL = 'http://localhost:3003/main';
window.NEXT_PUBLIC_SERVER_DIR_HTTP_URL = 'http://localhost:3003/main/direct';
window.NEXT_PUBLIC_SERVER_DEF_WS_URL = 'ws://localhost:3003/main';
window.NEXT_PUBLIC_SERVER_DIR_WS_URL = 'ws://localhost:3003/main/direct';

// API URLs
window.API_URL = 'http://localhost:3006';
window.NEXT_PUBLIC_API_URL = 'http://localhost:3006';