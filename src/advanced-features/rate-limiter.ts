export class RateLimiter { private requests = new Map(); allow(key: string) { const now = Date.now(); if (!this.requests.has(key)) this.requests.set(key, []); const times = this.requests.get(key)!; times.push(now); return times.filter(t => now - t < 60000).length < 100; } }
export default RateLimiter;
