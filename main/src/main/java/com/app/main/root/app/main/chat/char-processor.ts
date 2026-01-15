import { ChatService } from "./chat-service";

enum Status {
    PENDING = 'pending',
    LOADING = 'loading', 
    LOADED = 'loaded',
    ERROR = 'error',
    STUCK = 'stuck'
}

interface LoadState {
    chatId: string;
    chat: any;
    status: Status;
    startTime: number;
    lastUpdateTime: number;
    retryCount: number;
    error?: any;
}

interface ChatProcessingConfig {
    stuckTimeout: number;
    maxRetries: number;
    checkInterval: number;
    loadDelay: number;
}

export class ChatProcessor {
    private chatService: ChatService;
    private userId: string;

    private chatQueue: Map<string, LoadState> = new Map();
    private loadedChats: Set<string> = new Set();
    private processingQueue: string[] = [];
    private isProcessing: boolean = false;
    private monitorInterval: NodeJS.Timeout | null = null;

    private config: ChatProcessingConfig = {
        stuckTimeout: 5000,
        maxRetries: 3,
        checkInterval: 1000,
        loadDelay: 500
    }

    private onChatLoadedCallback?: (chat: any) => void;
    private onChatStuckCallback?: (chatId: string, retryCount: number) => void;
    private onAllChatsLoadedCallback?: () => void;
    private onChatErrorCallback?: (chatId: string, error: any) => void;

    constructor(
        chatService: ChatService, 
        userId: string, 
        config?: Partial<ChatProcessingConfig>
    ) {
        this.chatService = chatService;
        this.userId = userId;
        if(config) this.config = { ...this.config, ...config }
    }

    public async init(chats: any[]): Promise<void> {
        console.log(`[ChatProcessor] Initializing with ${chats.length} chats`);

        this.chatQueue.clear();
        this.loadedChats.clear();
        this.processingQueue = [];

        chats.forEach(chat => {
            const chatId = chat.id || chat.chatId || chat.groupId
            this.chatQueue.set(chatId, {
                chatId,
                chat,
                status: Status.PENDING,
                startTime: Date.now(),
                lastUpdateTime: Date.now(),
                retryCount: 0
            });
            this.processingQueue.push(chatId);
        });
        console.log(`[ChatProcessor] Queue initialized with ${this.processingQueue.length} chats`);
    }

    /**
     * Start
     */
    public async start(): Promise<void> {
        if(this.isProcessing) {
            console.warn('[ChatProcessor] Already processing');
            return;
        }

        console.log('[ChatProcessor] Starting chat processing');
        this.isProcessing = true;

        this.startMonitor();
        await this.processQueue();
    }

    /**
     * Stop
     */
    public stop(): void {
        console.log('[ChatProcessor] Stopping');
        this.isProcessing = false;
        this.stopMonitor();
    }

    /**
     * Process Queue
     */
    private async processQueue(): Promise<void> {
        while(this.isProcessing && this.processingQueue.length > 0) {
            const chatId = this.processingQueue[0];
            const state = this.chatQueue.get(chatId);
            if(!state) {
                console.warn(`[ChatProcessor] No state found for ${chatId}, skipping`);
                this.processingQueue.shift();
                continue;
            }

            if(this.loadedChats.has(chatId)) {
                console.log(`[ChatProcessor] Chat ${chatId} already loaded, skipping`);
                this.processingQueue.shift();
                continue;
            }

            if(state.retryCount >= this.config.maxRetries) {
                console.error(`[ChatProcessor] Chat ${chatId} exceeded max retries, marking as error`);
                state.status = Status.ERROR;
                this.processingQueue.shift();
                if(this.onChatErrorCallback) {
                    this.onChatErrorCallback(chatId, new Error('Max retries exceeded'));
                }
                continue;
            }

            await this.loadChat(chatId);
            this.processingQueue.shift();
            if(this.processingQueue.length > 0) {
                await this.delay(this.config.loadDelay);
            }
        }

        if(this.processingQueue.length === 0) {
            console.log('[ChatProcessor] All chats processed');
            this.stop();
            if(this.onAllChatsLoadedCallback) {
                this.onAllChatsLoadedCallback();
            }
        }
    }

    /**
     * Load Chat
     */
    private async loadChat(chatId: string): Promise<void> {
        const state = this.chatQueue.get(chatId);
        if(!state) return;

        try {
            console.log(`[ChatProcessor] Loading chat ${chatId} (attempt ${state.retryCount + 1})`);
            state.status = Status.LOADING;
            state.lastUpdateTime = Date.now();

            const chatData = await this.chatService.getData(
                this.userId,
                chatId,
                0,
                true
            );

            const hasData =
                (chatData.messages && chatData.messages.length > 0) ||
                (chatData.files && chatData.files.length > 0) ||
                (chatData.timeline && chatData.timeline.length > 0);
            if(hasData) {
                console.log(`[ChatProcessor] Successfully loaded chat ${chatId}`);
                state.status = Status.LOADED;
                state.lastUpdateTime = Date.now();
                this.loadedChats.add(chatId);
                if(this.onChatLoadedCallback) {
                    this.onChatLoadedCallback(state.chat);
                }
            } else {
                console.warn(`[ChatProcessor] Chat ${chatId} loaded but has no data`);
                state.status = Status.ERROR;
                return;
            }
        } catch(err) {
            console.error(`[ChatProcessor] Error loading chat ${chatId}:`, err);
            state.status = Status.ERROR;
            state.error = err;
            state.retryCount++;

            if(state.retryCount < this.config.maxRetries) {
                console.log(`[ChatProcessor] Will retry chat ${chatId} (attempt ${state.retryCount}/${this.config.maxRetries})`);
                this.processingQueue.push(chatId);
            } else {
                if(this.onChatErrorCallback) {
                    this.onChatErrorCallback(chatId, err);
                }
            }
        }
    }

    /**
     * Start Monitor
     */
    private startMonitor(): void {
        if(this.monitorInterval) return;
        console.log('[ChatProcessor] Starting stuck chat monitor');
        this.monitorInterval = setInterval(() => {
            this.checkForStuckChats();
        }, this.config.checkInterval);
    }

    /**
     * Stop Monitor
     */
    private stopMonitor(): void {
        if(this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
            console.log('[ChatProcessor] Stopped stuck chat monitor');
        }
    }

    private checkForStuckChats(): void {
        const now = Date.now();
        let stuckCount = 0;
        this.chatQueue.forEach((state, chatId) => {
            if(state.status === Status.LOADED || this.loadedChats.has(chatId)) {
                return;
            }

            const timeSinceLastUpdate = now - state.lastUpdateTime;
            if(timeSinceLastUpdate > this.config.stuckTimeout && state.status !== Status.ERROR) {
                stuckCount++;
                console.warn(`[ChatProcessor] Chat ${chatId} is stuck (${Math.floor(timeSinceLastUpdate / 1000)}s), forcing reload`);

                state.status = Status.STUCK;
                state.retryCount++;
                if(this.onChatStuckCallback) {
                    this.onChatStuckCallback(chatId, state.retryCount);
                }

                const queueIndex = this.processingQueue.indexOf(chatId);
                if(queueIndex === -1) {
                    this.processingQueue.unshift(chatId);
                    console.log(`[ChatProcessor] Added stuck chat ${chatId} to front of queue`);
                } else if(queueIndex > 0) {
                    this.processingQueue.splice(queueIndex, 1);
                    this.processingQueue.unshift(chatId);
                    console.log(`[ChatProcessor] Moved stuck chat ${chatId} to front of queue`);
                }

                if(!this.isProcessing && this.processingQueue.length > 0) {
                    console.log('[ChatProcessor] Restarting processing for stuck chats');
                    this.isProcessing = true;
                    this.processQueue();
                }
            }
        });
        if(stuckCount > 0) {
            console.log(`[ChatProcessor] Found ${stuckCount} stuck chats`);
        }
    }

    public getStatus(): {
        total: number;
        loaded: number;
        pending: number;
        loading: number;
        stuck: number;
        error: number;
        progress: number;
    } {
        const states = Array.from(this.chatQueue.values());
        return {
            total: this.chatQueue.size,
            loaded: this.loadedChats.size,
            pending: states.filter(s => s.status === Status.PENDING).length,
            loading: states.filter(s => s.status === Status.LOADING).length,
            stuck: states.filter(s => s.status === Status.STUCK).length,
            error: states.filter(s => s.status === Status.ERROR).length,
            progress: this.chatQueue.size > 0 
                ? Math.round((this.loadedChats.size / this.chatQueue.size) * 100)
                : 100
        }
    }

    public onChatLoaded(callback: (chat: any) => void): void {
        this.onChatLoadedCallback = callback;
    }

    public onChatStuck(callback: (chatId: string, retryCount: number) => void): void {
        this.onChatStuckCallback = callback;
    }

    public onAllChatsLoaded(callback: () => void): void {
        this.onAllChatsLoadedCallback = callback;
    }

    public onChatError(callback: (chatId: string, error: any) => void): void {
        this.onChatErrorCallback = callback;
    }

    /**
     * Delay
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public getChatState(chatId: string): LoadState | undefined {
        return this.chatQueue.get(chatId);
    }

    public getStuckChats(): LoadState[] {
        return Array.from(this.chatQueue.values())
            .filter(state => state.status === Status.STUCK);
    }

    /**
     * Force Load Chat
     */
    public async forceLoadChat(chatId: string): Promise<void> {
        const state = this.chatQueue.get(chatId);
        if(!state) {
            console.warn(`[ChatProcessor] Chat ${chatId} not in queue`);
            return;
        }
        console.log(`[ChatProcessor] Manually forcing load of chat ${chatId}`);
        await this.loadChat(chatId);
    }
}