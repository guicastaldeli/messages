export class UserServiceClient {
    private baseUrl: string | undefined;
    
    constructor(url: string | undefined) {
        this.baseUrl = url;
    }

    /**
     * Check User Exists
     */
    public async checkUserExists(email: string): Promise<boolean> {
        const res = await fetch(`${this.baseUrl}/api/users/email/${email}`);
        const data = await res.json();
        return data.exists || false;
    }

    /**
     * Check Username Exists
     */
    public async checkUsernameExists(username: string): Promise<boolean> {
        const res = await fetch(`${this.baseUrl}/api/users/username/${username}`);
        const data = await res.json();
        return data.exists || false;
    }
}