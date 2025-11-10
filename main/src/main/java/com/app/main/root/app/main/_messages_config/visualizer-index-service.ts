import { CacheData } from "@/app/_cache/cache-service-client";
import { ChunkManager } from "./chunk-manager";

export interface ViewportState {
    visibleStartIndex: number;
    visibleEndIndex: number;
    containerHeight: number;
    scrollTop: number;
    totalHeight: number;
    isScrolling: boolean;
}

export interface VisualizationMetrics {
    messagesPerViewport: number;
    averageMessageHeight: number;
    viewportEfficiency: number;
    loadTriggerThreshold: number
}

export class VisualizerIndexService {
    private chunkManager: ChunkManager;
    private container: HTMLDivElement;
    private messagesContainer: HTMLDivElement | null = null;
    
    private viewportState: ViewportState;
    private metrics: VisualizationMetrics;
    private observationInterval: NodeJS.Timeout | null = null;
    private pendingVisualizationUpdates: Set<string> = new Set();
    private batchUpdateTimeout: NodeJS.Timeout | null = null;
    
    private visualizedMessages: Map<string, boolean> = new Map();
    private lastReportedPage: number = -1;

    constructor(chunkManager: ChunkManager, container: HTMLDivElement) {
        this.chunkManager = chunkManager;
        this.container = container;
        this.viewportState = {
            visibleStartIndex: 0,
            visibleEndIndex: 0,
            containerHeight: 0,
            scrollTop: 0,
            totalHeight: 0,
            isScrolling: false
        }
        this.metrics = {
            messagesPerViewport: 5,
            averageMessageHeight: 80,
            viewportEfficiency: 0.8,
            loadTriggerThreshold: 4
        }
    }

    public setChatContainer(): HTMLDivElement | null {
        if(!this.messagesContainer) {
            this.messagesContainer = this.container.querySelector<HTMLDivElement>('.messages'); 
        } 
        if(!this.messagesContainer) {
            console.warn('div err');
            return null;
        }
        const rect = this.messagesContainer.getBoundingClientRect();
        console.log(`
            WIDTH: ${rect.width}
            HEIGHT: ${rect.height}
            SCROLL HEIGHT: ${this.messagesContainer.scrollHeight}
            VISIBLE MESSAGES: ${this.metrics.messagesPerViewport}
        `)

        return this.messagesContainer;
    }

    public startViewportMonitoring(): void {
        const container = this.setChatContainer();
        if(!container) return;

        this.setupContainerMetrics(container);
        this.setupScrollHandling(container);
        this.startPeriodicObservation();
    }

    public stopViewportMonitoring(): void {
        if(this.observationInterval) {
            clearInterval(this.observationInterval);
            this.observationInterval = null;
        }
        if(this.batchUpdateTimeout) {
            clearTimeout(this.batchUpdateTimeout);
            this.batchUpdateTimeout = null;
        }
    }

    /*
    ** Setup Container Metrics
    */
    private setupContainerMetrics(container: HTMLDivElement): void {
        const rect = container.getBoundingClientRect();
        this.viewportState.containerHeight = rect.height;
        this.viewportState.totalHeight = container.scrollHeight;
        this.calcViewportMetrics(container);
    }

    private calcViewportMetrics(container: HTMLDivElement): void {
        const messageEl = container.querySelectorAll('.message');
        if(messageEl.length === 0) return;

        let totalHeight = 0;
        messageEl.forEach(el => [
            totalHeight += el.getBoundingClientRect().height
        ]);
        
        this.metrics.averageMessageHeight = totalHeight / messageEl.length;
        this.metrics.messagesPerViewport = Math.floor(
            this.viewportState.containerHeight / this.metrics.averageMessageHeight
        );
        console.log(`Viewport metrics: ${this.metrics.messagesPerViewport} messages/viewport, avg height: ${this.metrics.averageMessageHeight}`);
    }

    /*
    ** Setup Scroll Handling
    */
    private setupScrollHandling(container: HTMLDivElement): void {
        let scrollTimeout: NodeJS.Timeout;
        container.addEventListener('scroll', () => {
            this.viewportState.isScrolling = true;
            this.viewportState.scrollTop = container.scrollTop;

            if(scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.viewportState.isScrolling = false;
                this.checkVisibleMessages(container);
            }, 150);
        });
        setTimeout(() => this.checkVisibleMessages(container), 100);
    }

    /*
    ** Start Periodic Observation
    */
    private startPeriodicObservation(): void {
        this.observationInterval = setInterval(() => {
            if(!this.viewportState.isScrolling) {
                const container = this.setChatContainer();
                if(container) this.checkVisibleMessages(container);
            }
        }, 500);
    }

    /*
    ** Check Visible Messages
    */
    private async checkVisibleMessages(container: HTMLDivElement): Promise<void> {
        const messageEl = container.querySelectorAll('.message');
        const containerRect = container.getBoundingClientRect();
        const visibleIndexes: number[] = [];
        const newlyVisualized: string[] = [];

        messageEl.forEach((el, i) => {
            const elRect = el.getBoundingClientRect();
            const isVisible = (
                elRect.bottom >= containerRect.top - 50 &&
                elRect.top <= containerRect.bottom + 50 &&
                elRect.right >= containerRect.left &&
                elRect.left <= containerRect.right
            );

            if(isVisible) {
                visibleIndexes.push(i);
                const messageId = el.getAttribute('data-message-id');
                if(messageId && !this.visualizedMessages.get(messageId)) {
                    this.visualizedMessages.set(messageId, true);
                    newlyVisualized.push(messageId);
                    this.pendingVisualizationUpdates.add(messageId);
                }
            }
        });

        if(visibleIndexes.length > 0) {
            this.viewportState.visibleStartIndex = Math.min(...visibleIndexes);
            this.viewportState.visibleEndIndex = Math.max(...visibleIndexes);
        }
        this.scheduleVisualizationUpdate();

        if(newlyVisualized.length >= this.metrics.loadTriggerThreshold) {
            await this.triggerPredictiveLoading();
        }
        
        console.log(`Visible messages: ${visibleIndexes.length} (${this.viewportState.visibleStartIndex}-${this.viewportState.visibleEndIndex})`);
    }

    /*
    ** Schedule Visualization Update
    */
    private scheduleVisualizationUpdate(): void {
        if(this.batchUpdateTimeout) clearTimeout(this.batchUpdateTimeout);
        this.batchUpdateTimeout = setTimeout(async () => {
            await this.processVisualizationUpdates();
        }, 1000);
    }

    /*
    ** Schedule Visualization Update
    */
    private async processVisualizationUpdates(): Promise<void> {
        if(this.pendingVisualizationUpdates.size === 0) return;

        const messageIds = Array.from(this.pendingVisualizationUpdates);
        this.pendingVisualizationUpdates.clear();

        try {
            await Promise.all(
                messageIds.map(id =>
                    this.updateMessageVisualization(id, true)
                )
            );

            console.log(`Updated ${messageIds.length} messages as visualized`);
        } catch(err) {
            console.error('Failed to update message visualization:', err);
            messageIds.forEach(id => this.pendingVisualizationUpdates.add(id));
        }
    }
    
    private async updateMessageVisualization(id: string, visualized: boolean): Promise<void> {
        const container = this.setChatContainer();
        if(!container) return;

        const messageElement = container.querySelector(`[data-message-id="${id}"]`);
        if (messageElement) {
            messageElement.classList.add('visualized');
            messageElement.setAttribute('data-visualized', 'true');
        }
        
        console.log(`Marked message ${id} as visualized`);
    }

    /*
    ** Trigger Predictive Loading
    */
    private async triggerPredictiveLoading(): Promise<void> {
        const currentChat = this.chunkManager.getMessageManager()
            .chatRegistry.getCurrentChat();
        if(!currentChat) {
            console.error('No current chat!');
            return;
        }

        const chatId = currentChat.id;
        const cacheData = this.chunkManager.getCacheService().getCacheData(chatId);
        if(!cacheData) {
            console.error('No cache data');
            return;
        }

        const currentPage = Math.floor(this.viewportState.visibleEndIndex / 20);
        if(currentPage === this.lastReportedPage) return;
        this.lastReportedPage = currentPage;

        const pagesToPreload = this.calcPagesToPreload(currentPage, cacheData);
        console.log(`Predictive loading for pages: ${Array.from(pagesToPreload)}`);

        for(const page of pagesToPreload) {
            if(!cacheData.loadedPages.has(page)) {
                try {
                    await this.chunkManager.getCacheService().getMessages(chatId, page);
                    console.log(`Preloaded page ${page} for chat ${chatId}`);
                } catch (error) {
                console.error(`Failed to preload page ${page}:`, error);
                }
            }
        }
    }

    /*
    ** Pages to Preload
    */
    private calcPagesToPreload(currentPage: number, cacheData: CacheData): Set<number> {
        const pagesToLoad = new Set<number>();
        const maxPages = 3;
        if(cacheData.hasMore) {
            for(let i = 1; i <= maxPages; i++) {
                const nextPage = currentPage + i;
                if(!cacheData.loadedPages.has(nextPage)) {
                    pagesToLoad.add(nextPage);
                }
            }
        }
        if(currentPage > 0) {
            for(let i = 1; i <= 2; i++) {
                const prevPage = currentPage - i;
                if(prevPage >= 0 && !cacheData.loadedPages.has(prevPage)) {
                    pagesToLoad.add(prevPage);
                }
            }
        }
        return pagesToLoad;
    }

    /*
    ** Visualization Stats
    */
    public getVisualizationStats(): {
        totalMessages: number;
        visualizedMessages: number;
        visualizationRate: number
    } {
        const totalMessages = this.visualizedMessages.size;
        const visualizedMessages = Array.from(this.visualizedMessages.values())
            .filter(v => v).length;
        const visualizationRate = 
            totalMessages > 0 ?
            visualizedMessages / totalMessages : 0; 
        
        return {
            totalMessages: totalMessages,
            visualizedMessages: visualizedMessages,
            visualizationRate: visualizationRate
        }
    }

    /*
    ** Reset
    */
    public resetForChat(id: string): void {
        this.visualizedMessages.clear();
        this.pendingVisualizationUpdates.clear();
        this.lastReportedPage = -1;
        this.messagesContainer = null;
        this.viewportState = {
            ...this.viewportState,
            visibleStartIndex: 0,
            visibleEndIndex: 0,
            scrollTop: 0
        }
    }

    public addMessageForTracking(id: string): void {
        if(!this.visualizedMessages.has(id)) {
            this.visualizedMessages.set(id, false);
            console.log(`📝 Tracking message: ${id}`);
        }
    }

    public initMessagesForTracking(ids: string[]): void {
        ids.forEach(id => {
            this.addMessageForTracking(id)
            console.log(`📝 Initialized ${ids.length} messages for tracking`);
        });
    }
}