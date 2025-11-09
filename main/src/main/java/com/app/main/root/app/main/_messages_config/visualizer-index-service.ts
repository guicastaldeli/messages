import { ChunkManager } from "./chunk-manager";

export class VizualizerIndexService {
    private chunkManager: ChunkManager;
    private container: HTMLDivElement;

    constructor(chunkManager: ChunkManager, container: HTMLDivElement) {
        this.chunkManager = chunkManager;
        this.container = container;
    }

    public setChatContainer(): void {
        const div = this.container.querySelector<HTMLDivElement>('.messages')
        console.log(`
            WIDTH: ${div?.offsetWidth}
            HEIGHT: ${div?.offsetHeight}
        `)
    }   
}