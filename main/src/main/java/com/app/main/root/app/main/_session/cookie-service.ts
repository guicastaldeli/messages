interface Options {
    days?: number;
    path?: string;
    domain?: string;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
}

export class CookieService {
    /**
     * Set
     */
    public static set(name: string, value: string, options: Options): void {
        if(typeof document === 'undefined') return;

        const {
            days = 7,
            path = '/',
            domain = '',
            secure = false,
            sameSite = 'Lax'
        } = options;
        
        const expires = new Date(
            Date.now() + (days * 24 * 60 * 60 * 1000)
        ).toUTCString();

        let cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=${path}`;
        
        if(domain) cookie += `; domain=${domain}`;
        if(secure) cookie += `; Secure`;
        if(sameSite) cookie += `; SameSite=${sameSite}`;
        
        console.log(`[CookieService] Setting cookie:`, cookie);
        document.cookie = cookie;
        
        const check = document.cookie;
        console.log(`[CookieService] After setting, cookies now:`, check);
    }
    
    /**
     * Get Value
     */
    public static getValue(name: string): string | null {
        if(typeof document === 'undefined') return null;
        
        console.log(`[CookieService] Looking for: ${name}`);
        console.log(`[CookieService] Raw document.cookie:`, JSON.stringify(document.cookie));
        
        const cookies = document.cookie.split(';');
        console.log(`[CookieService] Split cookies:`, cookies);
        
        for(let cookie of cookies) {
            const trimmed = cookie.trim();
            console.log(`[CookieService] Processing:`, JSON.stringify(trimmed));
            
            const [cookieName, cookieVal] = trimmed.split('=');
            if(cookieName === name) {
                const value = decodeURIComponent(cookieVal);
                console.log(`[CookieService] Found ${name}:`, value);
                return value;
            }
        }
        console.log(`[CookieService] Cookie not found: ${name}`);
        return null;
    }

    /**
     * Delete Cookie
     */
    public static deleteCookie(
        name: string,
        path: string = '/',
        domain?: string
    ): void {
        if(typeof document === 'undefined') return;

        let cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}`;
        if(domain) cookie += `; domain=${domain}`;
        
        console.log('[CookieService] Deleting cookie:', cookie);
        document.cookie = cookie;
    }
    
    /**
     * Has Cookie
     */
    public static hasCookie(name: string): boolean {
        return this.getValue(name) != null;
    }
    
    /**
     * Get All Cookies
     */
    public static getAllCookies(): Record<string, string> {
        const cookies: Record<string, string> = {};
        document.cookie.split(';').forEach(cookie => {
            const [name, value] = cookie.trim().split('=');
            if(name && value) cookies[name] = decodeURIComponent(value);
        });
        return cookies;
    }

    /**
     * Clear All Cookies
     */
    public static clearAllCookies(): void {
        const cookies = this.getAllCookies();
        Object.keys(cookies).forEach(name => {
            this.deleteCookie(name);
        });
    }
}