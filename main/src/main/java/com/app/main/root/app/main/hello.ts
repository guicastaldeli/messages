export class Hello {
    public el: HTMLDivElement[] = [];
    public fontChangeIntervals: NodeJS.Timeout[] = [];

    /**
     * Create Element
     */
    private createEl(row: HTMLElement): void {
        const el = document.createElement('div');
        el.className = 'hello-text';
        el.textContent = 'hello';
        
        const left = Math.random() * 200 - 50;
        const top = Math.random() * 100;
        const dir = Math.random() > 0.5 ? 'left' : 'right';

        const duration = Math.random() * 5 + 10;
        const delay = Math.random() * 10;

        const fontIndex = Math.floor(Math.random() * 10);

        el.style.left = `${left}%`;
        el.style.top = `${top}%`;
        el.style.animationDelay = `${delay}s`;
        el.style.animationDuration = `${duration}s`;
        el.classList.add(dir);
        el.setAttribute('data-font', fontIndex.toString());

        row.appendChild(el);
        this.el.push(el);

        this.setupFontChange(el);
    }

    private setupFontChange(el: HTMLDivElement): void {
        const interval = setInterval(() => {
            const newFontIndex = Math.floor(Math.random() * 10);
            el.setAttribute('data-font', newFontIndex.toString());
        }, Math.random() * 2500 + 500);
        this.fontChangeIntervals.push(interval);
    }

    /**
     * Create Row
     */
    private createRow(container: HTMLElement, rowIndex: number): void {
        const row = document.createElement('div');
        row.className = 'hello-row';

        const count = Math.floor(Math.random() * 150);
        for(let i = 0; i < count; i++) this.createEl(row);

        container.appendChild(row);
    }

    public init(): void {
        const container = document.querySelector('.letter-container');
        if(!container) return;

        for(let row = 0; row < 10; row++) {
            this.createRow(container as HTMLElement, row);
        }
    }
}