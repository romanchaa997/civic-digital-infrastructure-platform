export class CacheLayer {
  private cache = new Map();
  get(key: string) { return this.cache.get(key); }
  set(key: string, value: any) { this.cache.set(key, value); }
  clear() { this.cache.clear(); }
  delete(key: string) { this.cache.delete(key); }
}
export default CacheLayer;
