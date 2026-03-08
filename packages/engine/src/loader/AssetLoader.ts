export class AssetLoader {
  private cache: Map<string, HTMLImageElement> = new Map();

  async loadImage(src: string): Promise<HTMLImageElement> {
    if (this.cache.has(src)) {
      return this.cache.get(src)!;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.cache.set(src, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  getImage(src: string): HTMLImageElement | undefined {
    return this.cache.get(src);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const assetLoader = new AssetLoader();
