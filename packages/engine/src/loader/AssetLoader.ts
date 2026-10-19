export class AssetLoader {
  private cache: Map<string, HTMLImageElement> = new Map();
  private pending: Map<string, Promise<HTMLImageElement>> = new Map();
  private failed: Set<string> = new Set();

  async loadImage(src: string): Promise<HTMLImageElement> {
    const cached = this.cache.get(src);
    if (cached) return cached;
    const inFlight = this.pending.get(src);
    if (inFlight) return inFlight;

    const load = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.cache.set(src, img);
        this.pending.delete(src);
        resolve(img);
      };
      img.onerror = (err) => {
        this.pending.delete(src);
        this.failed.add(src);
        reject(err);
      };
      img.src = src;
    });
    this.pending.set(src, load);
    return load;
  }

  getImage(src: string): HTMLImageElement | undefined {
    return this.cache.get(src);
  }

  /**
   * The image if it has loaded; otherwise starts loading it (once) and
   * returns undefined, so a renderer can call this every frame. An image that
   * failed to load isn't retried until `clear()`.
   */
  requestImage(src: string): HTMLImageElement | undefined {
    const img = this.cache.get(src);
    if (img || this.pending.has(src) || this.failed.has(src)) return img;
    this.loadImage(src).catch(() => console.warn(`Failed to load image: ${src}`));
    return undefined;
  }

  clear(): void {
    this.cache.clear();
    this.pending.clear();
    this.failed.clear();
  }
}

export const assetLoader = new AssetLoader();
