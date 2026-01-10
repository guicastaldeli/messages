export class Tick {
    private static readonly TICKS_PER_SEC = 20;
    private static readonly MS_PER_TICK = 1000 / Tick.TICKS_PER_SEC;

    private lastTickTime: number = 0;
    private accumulatedTime: number = 0;
    private tickCount: number = 0;

    private tickCallbacks: Array<(deltaTime: number) => void> = [];

    public onTick(cb: (deltaTime: number) => void): void {
        this.tickCallbacks.push(cb);
    }

    public getTickCount(): number {
        return this.tickCount;
    }

    public static getTicksPerSec(): number {
        return Tick.TICKS_PER_SEC;
    }

    public static getDeltaTime(): number {
        return Tick.MS_PER_TICK / 1000;
    }

    /**
     * Process Tick
     */
    private processTick(deltaTime: number): void {
        for(const cb of this.tickCallbacks) {
            cb(deltaTime);
        }
    }

    /**
     * Update
     */
    public update(currentTime: number): void {
        if(this.lastTickTime === 0) {
            this.lastTickTime = currentTime;
            return;
        }

        const deltaTime = currentTime - this.lastTickTime;
        this.lastTickTime = currentTime;
        this.accumulatedTime += deltaTime;

        while(this.accumulatedTime >= Tick.MS_PER_TICK) {
            this.processTick(Tick.MS_PER_TICK / 1000);
            this.accumulatedTime -= Tick.MS_PER_TICK;
            this.tickCount++;
        }
    }
}