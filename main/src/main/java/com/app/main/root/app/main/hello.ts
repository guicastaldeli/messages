type Point = { 
    x: number; 
    y: number; 
};

export class Hello {
    public el: HTMLDivElement[] = [];
    private fontTimer?: ReturnType<typeof setInterval>;
    private next: number[] = [];

    // Start Font Shuffle
    private startFontShuffle(): void {
        this.next = this.el.map(() => performance.now() + Math.random() * 3000);
        this.fontTimer = setInterval(() => {
            const now = performance.now();
            for(let i = 0; i < this.el.length; i++) {
                if(now >= this.next[i]) {
                    this.el[i].setAttribute('data-font', String(Math.floor(Math.random() * 10)));
                    this.next[i] = now + Math.random() * 2500 + 500;
                }
            }
        }, 100);
    }

    /**
     * Create Element
     */
    private createEl(parent: Node, left: number, top: number): void {
        const fontIndex = Math.floor(Math.random() * 10);

        const el = document.createElement('div');
        el.className = 'hello-text';
        el.textContent = 'hello';
        el.style.left = `${left}%`;
        el.style.top = `${top}%`;
        el.setAttribute('data-font', fontIndex.toString());

        parent.appendChild(el);
        this.el.push(el);
    }

    /**
     * Create Row
     */
    private createRow(container: HTMLElement): void {
        const dir = Math.random() > 0.5 ? 'left' : 'right';
        const duration = Math.random() * 8 + 100;
        const delay = -Math.random() * 10;

        const row = document.createElement('div');
        row.className = 'hello-row';
        row.classList.add(dir);
        row.style.animationDuration = `${duration}s`;
        row.style.animationDelay = `${delay}s`;

        const cols = 20;
        const rows = 8;
        
        const X_MIN = -50;
        const X_MAX = 150;
        const Y_MIN = 0;
        const Y_MAX = 100;
        const cellW = (X_MAX - X_MIN) / cols;
        const cellH = (Y_MAX - Y_MIN) / rows;
        const JITTER = 0.6;

        const slots: Point[] = [];
        for(let r = 0; r < rows; r++) {
            for(let c = 0; c < cols; c++) {
                slots.push({
                    x: X_MIN + c * cellW + cellW / 2,
                    y: Y_MIN + r * cellH + cellH / 2
                });
            }
        }
        for(let i = slots.length - 1; i > 0; i--) {
            const j  = Math.floor(Math.random() * (i + 1));
            [slots[i], slots[j]] = [slots[j], slots[i]];
        }

        const final = Math.floor(Math.random() * 150);
        const count = Math.min(final, slots.length);

        const fragment = document.createDocumentFragment();
        for(let i = 0; i < count; i++) {
            const slot = slots[i];
            const jx = (Math.random() - 0.5) * cellW * JITTER;
            const jy = (Math.random() - 0.5) * cellH * JITTER;
            this.createEl(fragment, slot.x + jx, slot.y + jy);
        }

        row.appendChild(fragment);
        container.appendChild(row);
    }

    /**
     * 
     * Init
     * 
     */
    public init(): void {
        const container = document.querySelector('.letter-container');
        if(!container) return;

        for(let row = 0; row < 10; row++) this.createRow(container as HTMLElement);
        this.startFontShuffle();
    }

    /**
     * 
     * Destroy
     * 
     */
    public destroy(): void {
        if(this.fontTimer) clearInterval(this.fontTimer);
        this.fontTimer = undefined;
        this.el = [];
        this.next = [];
    }
}