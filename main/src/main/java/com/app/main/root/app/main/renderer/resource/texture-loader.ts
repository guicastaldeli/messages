export interface TextureData {
    url: string;
    texture: GPUTexture | null;
    view: GPUTextureView | null;
    sampler: GPUSampler | null;
    dimension: { width: number, height: number };
    format: GPUTextureFormat;
}

export class TextureLoader {
    private static readonly URL = './data/resource/texture/'; 

    private static instance: TextureLoader;
    private device: GPUDevice | null = null;
    private textures: Map<string, TextureData> = new Map();
    private defaultSampler: GPUSampler | null = null;
    
    public static getInstance(): TextureLoader {
        if(!TextureLoader.instance) {
            TextureLoader.instance = new TextureLoader();
        }
        return TextureLoader.instance;
    }

    public setDevice(device: GPUDevice): void {
        this.device = device;
        this.createDefaultSampler();
    }

    /**
     * Create Default Texture View
     */
    public createDefaultTextureView(): GPUTextureView {
        const texture = this.device!.createTexture({
            size: [1, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
        });
        this.device!.queue.writeTexture(
            { texture },
            new Uint8Array([ 255, 255, 255, 255 ]),
            {},
            [1, 1]
        );
        return texture.createView();
    }

    /**
     * Create Sampler
     */
    public createDefaultSampler(): void {
        if(!this.device) throw new Error('device err');

        this.defaultSampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear',
            addressModeU: 'repeat',
            addressModeV: 'repeat'
        });
    }

    public createSampler(): GPUSampler {
        if(!this.device) throw new Error('Device err');

        return this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear',
            addressModeU: 'repeat',
            addressModeV: 'repeat'
        });
    }

    /**
     * Load
     */
    public async load(url: string): Promise<TextureData> {
        if(!this.device) throw new Error('Device err');

        try {
            const fullUrl = `${TextureLoader.URL}${url}`;
            const res = await fetch(fullUrl);
            const blob = await res.blob();
            const imgBitmap = await createImageBitmap(
                blob, { 
                    imageOrientation: 'flipY',
                    premultiplyAlpha: 'premultiply'
                }
            );

            const tex = this.device.createTexture({
                size: {
                    width: imgBitmap.width,
                    height: imgBitmap.height,
                    depthOrArrayLayers: 1
                },
                format: 'rgba8unorm',
                usage: GPUTextureUsage.TEXTURE_BINDING |
                    GPUTextureUsage.COPY_DST |
                    GPUTextureUsage.RENDER_ATTACHMENT,
                mipLevelCount: 1
            });

            this.device.queue.copyExternalImageToTexture(
                { source: imgBitmap },
                { texture: tex },
                { width: imgBitmap.width, height: imgBitmap.height }
            );

            const texTextureData: TextureData = {
                url,
                texture: tex,
                view: tex.createView(),
                sampler: this.defaultSampler,
                dimension: { width: imgBitmap.width, height: imgBitmap.height },
                format: 'rgba8unorm'
            }

            return texTextureData;
        } catch(err) {
            console.error(`Failed to load texture ${url}:`, err);
            throw err;
        }
    }

    private calculateMipLevels(width: number, height: number): number {
        return 1 + Math.floor(Math.log2(Math.max(width, height)));
    }

    public getTexture(name: string): TextureData | undefined {
        return this.textures.get(name);
    }

    public getAllTextures(): TextureData[] {
        return Array.from(this.textures.values());
    }

    public cleanup(): void {
        for(const textureTextureData of this.textures.values()) {
            textureTextureData.texture?.destroy();
        }
        this.textures.clear();
    }
}