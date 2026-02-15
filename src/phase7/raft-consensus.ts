export class RaftConsensus{private term=0;private votedFor=null;private state='follower';async requestVote(c:number,l:number){if(c>this.term){this.term=c;this.votedFor=c;return true;}return false;}async appendEntries(t:number,entries:any[]){if(t>=this.term){this.term=t;this.state='follower';return true;}return false;}}
export default RaftConsensus;
