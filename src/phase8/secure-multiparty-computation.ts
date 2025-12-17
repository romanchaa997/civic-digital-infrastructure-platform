export class SecureMPC{private shares=new Map();async generateShares(secret:number,parties:number){const shares=[];for(let i=0;i<parties;i++) shares.push(Math.random()*secret);this.shares.set(secret,shares);return shares;}async reconstruct(shares:number[]){return shares.reduce((a,b)=>a+b,0)%256;}async secureAdd(a:number[],b:number[]){return a.map((v,i)=>v+b[i]);}}
export default SecureMPC;
