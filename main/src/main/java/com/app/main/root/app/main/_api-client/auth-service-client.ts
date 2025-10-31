export class AuthServiceClient {
    private baseUrl: string | undefined;
    
    constructor(url: string | undefined) {
        this.baseUrl = url;
    }

    /*
    ** Register User
    */
    public async registerUser(userData: {
        email: string,
        username: string,
        password: string,
        sessionId: string
    }) {
        const res = await fetch(`${this.baseUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        const data = await res.json();
        if(!res.ok) throw new Error(data.detail || data.message || 'Registration failed!');
        console.log(data)
        return data;
    }

    /*
    ** Login User
    */
    public async loginUser(userData: {
        email: string,
        password: string,
        sessionId: string
    }) {
        const res = await fetch(`${this.baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        const data = await res.json();
        if(!res.ok) throw new Error(data.detail || data.message || 'Login failed!');
        return data;
    }
}