/**
 * 
 * 
 * 
 * ###### Input Sanitizer for the Client side,
 * ###### to sanitize all Inputs from the Document.
 * 
 * 
 * 
 */

export enum TypeMap {
    EMAIL = 'email', 
    USERNAME = 'username', 
    PASSWORD = 'password', 
    TEXT = 'text'
}

class InputSanitizer {
    /**
     * 
     * Sanitize
     * 
     */
    public static sanitize(value: string): string {
        if(!value) return '';

        let cleaned = value.replace(/<[^>]*>/g, '');
        cleaned = this.decodeHtmlEntities(cleaned);
        cleaned = cleaned.replace(/\0/g, '');
        cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        return cleaned;
    }

    /**
     * Decode HTML Entities
     */
    private static decodeHtmlEntities(text: string): string {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value;
    }

    /**
     * Escape HTML special chars
     */
    static escapeHtml(text: string): string {
        if(!text) return '';

        const map: { [key: string]: string } = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;',
            '`': '&#x60;',
            '=': '&#x3D;'
        }

        return text.replace(/[&<>"'`=\/]/g, (char) => map[char]);
    }

    /**
     * Remove Dangerous Patterns
     */
    private static removeDangerousPatterns(text: string): string {
          if(!text) return '';
        
        //Remove javascript: protocol
        text = text.replace(/javascript:/gi, '');
        
        //Remove data: protocol
        text = text.replace(/data:/gi, '');
        
        //Remove vbscript: protocol
        text = text.replace(/vbscript:/gi, '');
        
        //Remove on* event handlers
        text = text.replace(/on\w+\s*=/gi, '');
        
        //Remove script tags and their content
        text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        
        //Remove style tags
        text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
        
        //Remove iframe tags
        text = text.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
        
        //Remove object/embed tags
        text = text.replace(/<(object|embed)[^>]*>/gi, '');
        
        return text;
    }

    /**
     * 
     * Sanitize Email Input
     * 
     */
    public static sanitizeEmail(email: string): string {
        if(!email) return '';

        let cleaned = this.removeDangerousPatterns(email);
        cleaned = cleaned.replace(/<[^>]*>/g, '');
        cleaned = cleaned.trim();
        cleaned = cleaned.toLowerCase();
        cleaned = cleaned.replace(/[^a-z0-9@._+-]/g, '');
        if(cleaned.length > 256) cleaned = cleaned.substring(0, 254);

        const atCount = (cleaned.match(/@/g) || []).length;
        if(atCount > 1) {
            const parts = cleaned.split('@');
            cleaned = parts[0] + '@' + parts.slice(1).join('');
        }

        return cleaned;
    }

    /**
     * 
     * Sanitize Username Input
     * 
     */
    public static sanitizeUsername(username: string): string {
        if(!username) return '';

        let cleaned = this.removeDangerousPatterns(username);
        cleaned = cleaned.replace(/<[^>]*>/g, '');
        cleaned = cleaned.trim();
        cleaned = cleaned.replace(/[^a-zA-Z0-9_-]/g, '');
        cleaned = cleaned.replace(/^[_-]+/, '');
        if(cleaned.length > 20) cleaned = cleaned.substring(0, 20);
        return cleaned;
    }

    /**
     * 
     * Sanitize Password Input
     * 
     */
    public static sanitizePassword(password: string): string {
          if(!password) return '';
        
        let cleaned = this.removeDangerousPatterns(password);
        cleaned = cleaned.replace(/<[^>]*>/g, '');
        cleaned = cleaned.replace(/\0/g, '');
        cleaned = cleaned.trim();
        if(cleaned.length > 128) cleaned = cleaned.substring(0, 128);
        
        return cleaned;
    }

    /**
     * 
     * Sanitize General Text Input
     * 
     */
    public static sanitizeText(text: string): string {
        if(!text) return '';
        
        let cleaned = this.removeDangerousPatterns(text);
        cleaned = cleaned.replace(/<[^>]*>/g, '');
        cleaned = cleaned.trim();
        cleaned = cleaned.replace(/\0/g, '');
        return cleaned;
    }

    /**
     * 
     * Sanitize Single Input Element
     * 
     */
    public static sanitizeInputElement(input: HTMLInputElement | HTMLTextAreaElement): void {
        if(!input || !input.value) return;

        const type = input.type.toLowerCase();
        let sanitized: string;

        switch(type) {
            case 'email':
                sanitized = this.sanitizeEmail(input.value);
                break;
            case 'password':
                sanitized = this.sanitizePassword(input.value);
                break;
            case 'text':
            case 'search':
            case 'tel':
            case 'url':
            default:
                const sanitizeAs = input.getAttribute('data-sanitize-as');
                  if(sanitizeAs === 'username') {
                    sanitized = this.sanitizeUsername(input.value);
                } else if(sanitizeAs === 'email') {
                    sanitized = this.sanitizeEmail(input.value);
                } else {
                    sanitized = this.sanitizeText(input.value);
                }
                break;
        }

        if(input.value !== sanitized) {
            input.value = sanitized;
        }
    }

    /**
     * Get all Inputs
     */
    public static getAllInputs(): (HTMLInputElement | HTMLTextAreaElement)[] {
        const inputs: (HTMLInputElement | HTMLTextAreaElement)[] = [];
        
        const htmlInputs = document.querySelectorAll('input');
        htmlInputs.forEach(input => inputs.push(input));
        
        const textareas = document.querySelectorAll('textarea');
        textareas.forEach(textarea => inputs.push(textarea));
        
        return inputs;
    }

    /**
     * Get all Inputs in a Container
     */
    public static getInputsInContainer(container: HTMLElement): (HTMLInputElement | HTMLTextAreaElement)[] {
        const inputs: (HTMLInputElement | HTMLTextAreaElement)[] = [];
        
        const htmlInputs = container.querySelectorAll('input');
        htmlInputs.forEach(input => inputs.push(input));

        const textareas = container.querySelectorAll('textarea');
        textareas.forEach(textarea => inputs.push(textarea));
        
        return inputs;
    }

    /**
     * Sanitize all Inputs
     */
    public static sanitizeAllInputs(): void {
        const inputs = this.getAllInputs();
        inputs.forEach(input => this.sanitizeInputElement(input));
    }

    /**
     * Sanitize all Inputs in a Container
     */
    public static sanitizeInputsInContainer(container: HTMLElement): void {
        const inputs = this.getInputsInContainer(container);
        inputs.forEach(input => this.sanitizeInputElement(input));
    }

    /**
     * Sanitize Inputs by Selector
     */
    public static sanitizeInputsBySelector(selector: string): void {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            if(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
                this.sanitizeInputElement(element);
            }
        });
    }

    /**
     * Add Live Sanitization
     */
    public static addLiveSanitization(input: HTMLInputElement | HTMLTextAreaElement): void {
        input.addEventListener('blur', () => {
            this.sanitizeInputElement(input);
        });
        input.addEventListener('paste', (e) => {
            setTimeout(() => {
                this.sanitizeInputElement(input);
            }, 0);
        });
    }

    /**
     * Add Live Sanitization to All
     */
    public static addLiveSanitizationToAll(): void {
        const inputs = this.getAllInputs();
        inputs.forEach(input => this.addLiveSanitization(input));
    }

    /**
     * Add Live Sanitization to all Inputs in a Container
     */
    public static addLiveSanitizationToContainer(container: HTMLElement): void {
        const inputs = this.getInputsInContainer(container);
        inputs.forEach(input => this.addLiveSanitization(input));
    }

    /**
     * Sanitize and get value from a ref
     */
    public static sanitizeRefValue(
        ref: React.RefObject<HTMLInputElement | null>,
        type: TypeMap
    ): string {
        if(!ref.current) return '';

        const value = ref.current.value;
        switch (type) {
            case TypeMap.EMAIL:
                return this.sanitizeEmail(value);
            case TypeMap.USERNAME:
                return this.sanitizeUsername(value);
            case TypeMap.PASSWORD:
                return this.sanitizePassword(value);
            case TypeMap.TEXT:
            default:
                return this.sanitizeText(value);
        }
    }

    /**
     * 
     * Sanitize Url
     * 
     */
    public static sanitizeUrl(url: string): string {
          if(!url) return '';
        
        let cleaned = url.trim();
        
        const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
        for(const protocol of dangerousProtocols) {
            if(cleaned.toLowerCase().startsWith(protocol)) {
                return '';
            }
        }

        if(cleaned.match(/^[a-z]+:/i)) {
            if(!cleaned.match(/^(https?|ftp):/i)) {
                return '';
            }
        }
        
        return cleaned;
    }

    /**
     * 
     * Sanitize Object
     * 
     */
    public static SanitizeObject<T extends Record<string, any>>(obj: T, typeMap?: Partial<Record<keyof T, TypeMap>>) {
        const sanitized = { ...obj };

        for(const key in sanitized) {
            if(typeof sanitized[key] === 'string') {
                const type = typeMap?.[key] || TypeMap.TEXT;

                switch(type)  {
                    case TypeMap.EMAIL:
                        sanitized[key] = this.sanitizeEmail(sanitized[key]) as any;
                        break;
                    case TypeMap.USERNAME:
                        sanitized[key] = this.sanitizeUsername(sanitized[key]) as any;
                        break;
                    case TypeMap.PASSWORD:
                        sanitized[key] = this.sanitizePassword(sanitized[key]) as any;
                        break;
                    case TypeMap.TEXT:
                    default:
                        sanitized[key] = this.sanitizeText(sanitized[key]) as any;
                        break;
                }
            }
        }

        return sanitized;
    }
}

export default InputSanitizer;