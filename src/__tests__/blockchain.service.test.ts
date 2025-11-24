import { describe, it, expect, beforeEach, jest } from '@jest/globals';

interface Transaction {
  hash: string;
  from: string;
  to: string;
  amount: number;
  timestamp: number;
  confirmed: boolean;
}

interface Block {
  index: number;
  timestamp: number;
  transactions: Transaction[];
  hash: string;
  previousHash: string;
}

class BlockchainService {
  private chain: Block[] = [];
  private pendingTransactions: Transaction[] = [];
  private difficulty: number = 4;
  private miningReward: number = 10;
  private nodeMap: Set<string> = new Set();

  constructor() {
    this.chain.push(this.createGenesisBlock());
  }

  private createGenesisBlock(): Block {
    return {
      index: 0,
      timestamp: Date.now(),
      transactions: [],
      hash: '0',
      previousHash: '0'
    };
  }

  addTransaction(from: string, to: string, amount: number): boolean {
    if (amount <= 0 || !from || !to) {
      return false;
    }
    this.pendingTransactions.push({
      hash: this.hashTransaction({ from, to, amount }),
      from,
      to,
      amount,
      timestamp: Date.now(),
      confirmed: false
    });
    return true;
  }

  private hashTransaction(tx: any): string {
    return `tx_${Buffer.from(JSON.stringify(tx)).toString('hex')}`;
  }

  minePendingTransactions(minerAddress: string): boolean {
    if (this.pendingTransactions.length === 0) {
      return false;
    }

    const block: Block = {
      index: this.chain.length,
      timestamp: Date.now(),
      transactions: this.pendingTransactions,
      hash: '',
      previousHash: this.chain[this.chain.length - 1].hash
    };

    block.hash = this.mineBlock(block);
    this.chain.push(block);
    this.pendingTransactions = [];
    return true;
  }

  private mineBlock(block: Block): string {
    let hash = this.hashBlock(block);
    let nonce = 0;
    while (!hash.startsWith('0'.repeat(this.difficulty))) {
      nonce++;
      hash = this.hashBlock({ ...block, nonce } as any);
    }
    return hash;
  }

  private hashBlock(block: Block): string {
    return Buffer.from(JSON.stringify(block)).toString('hex');
  }

  isChainValid(): boolean {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }
    }
    return true;
  }

  getBalance(address: string): number {
    let balance = 0;
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.from === address) balance -= tx.amount;
        if (tx.to === address) balance += tx.amount;
      }
    }
    return balance;
  }

  getChainLength(): number {
    return this.chain.length;
  }

  getPendingTransactionCount(): number {
    return this.pendingTransactions.length;
  }

  addNode(nodeAddress: string): void {
    this.nodeMap.add(nodeAddress);
  }

  getNodeCount(): number {
    return this.nodeMap.size;
  }

  validateTransaction(tx: Transaction): boolean {
    return tx.amount > 0 && tx.from && tx.to && tx.hash;
  }
}

describe('BlockchainService', () => {
  let blockchain: BlockchainService;

  beforeEach(() => {
    blockchain = new BlockchainService();
  });

  describe('blockchain initialization', () => {
    it('should create blockchain with genesis block', () => {
      expect(blockchain.getChainLength()).toBe(1);
    });

    it('should have no pending transactions initially', () => {
      expect(blockchain.getPendingTransactionCount()).toBe(0);
    });

    it('should start with empty node list', () => {
      expect(blockchain.getNodeCount()).toBe(0);
    });

    it('should be valid on creation', () => {
      expect(blockchain.isChainValid()).toBe(true);
    });
  });

  describe('transaction management', () => {
    it('should add valid transactions', () => {
      const result = blockchain.addTransaction('Alice', 'Bob', 50);
      expect(result).toBe(true);
      expect(blockchain.getPendingTransactionCount()).toBe(1);
    });

    it('should reject negative amounts', () => {
      const result = blockchain.addTransaction('Alice', 'Bob', -10);
      expect(result).toBe(false);
      expect(blockchain.getPendingTransactionCount()).toBe(0);
    });

    it('should reject zero amount', () => {
      const result = blockchain.addTransaction('Alice', 'Bob', 0);
      expect(result).toBe(false);
    });

    it('should reject transaction with missing from address', () => {
      const result = blockchain.addTransaction('', 'Bob', 10);
      expect(result).toBe(false);
    });

    it('should reject transaction with missing to address', () => {
      const result = blockchain.addTransaction('Alice', '', 10);
      expect(result).toBe(false);
    });

    it('should add multiple transactions', () => {
      blockchain.addTransaction('Alice', 'Bob', 30);
      blockchain.addTransaction('Bob', 'Charlie', 20);
      blockchain.addTransaction('Charlie', 'Alice', 10);
      expect(blockchain.getPendingTransactionCount()).toBe(3);
    });

    it('should validate transaction structure', () => {
      const tx: Transaction = {
        hash: 'hash123',
        from: 'Alice',
        to: 'Bob',
        amount: 50,
        timestamp: Date.now(),
        confirmed: false
      };
      expect(blockchain.validateTransaction(tx)).toBe(true);
    });
  });

  describe('mining', () => {
    it('should mine pending transactions', () => {
      blockchain.addTransaction('Alice', 'Bob', 50);
      const result = blockchain.minePendingTransactions('Miner');
      expect(result).toBe(true);
      expect(blockchain.getChainLength()).toBe(2);
      expect(blockchain.getPendingTransactionCount()).toBe(0);
    });

    it('should not mine with no pending transactions', () => {
      const result = blockchain.minePendingTransactions('Miner');
      expect(result).toBe(false);
      expect(blockchain.getChainLength()).toBe(1);
    });

    it('should create new blocks for each mine', () => {
      blockchain.addTransaction('Alice', 'Bob', 50);
      blockchain.minePendingTransactions('Miner');
      blockchain.addTransaction('Bob', 'Charlie', 25);
      blockchain.minePendingTransactions('Miner');
      expect(blockchain.getChainLength()).toBe(3);
    });

    it('should add all pending transactions to block', () => {
      blockchain.addTransaction('Alice', 'Bob', 30);
      blockchain.addTransaction('Bob', 'Charlie', 20);
      blockchain.minePendingTransactions('Miner');
      expect(blockchain.getChainLength()).toBe(2);
    });
  });

  describe('blockchain validation', () => {
    it('should validate valid chain', () => {
      blockchain.addTransaction('Alice', 'Bob', 50);
      blockchain.minePendingTransactions('Miner');
      expect(blockchain.isChainValid()).toBe(true);
    });

    it('should remain valid after multiple blocks', () => {
      for (let i = 0; i < 5; i++) {
        blockchain.addTransaction(`User${i}`, `User${i + 1}`, 10 + i);
        blockchain.minePendingTransactions('Miner');
        expect(blockchain.isChainValid()).toBe(true);
      }
    });
  });

  describe('balance management', () => {
    it('should calculate balance correctly', () => {
      blockchain.addTransaction('Alice', 'Bob', 50);
      blockchain.minePendingTransactions('Miner');
      const aliceBalance = blockchain.getBalance('Alice');
      expect(aliceBalance).toBe(-50);
    });

    it('should track multiple transactions', () => {
      blockchain.addTransaction('Alice', 'Bob', 30);
      blockchain.minePendingTransactions('Miner');
      blockchain.addTransaction('Bob', 'Alice', 10);
      blockchain.minePendingTransactions('Miner');
      expect(blockchain.getBalance('Alice')).toBe(-20);
      expect(blockchain.getBalance('Bob')).toBe(20);
    });

    it('should handle complex multi-user scenarios', () => {
      blockchain.addTransaction('Alice', 'Bob', 100);
      blockchain.addTransaction('Charlie', 'Alice', 50);
      blockchain.minePendingTransactions('Miner');
      expect(blockchain.getBalance('Alice')).toBe(-50);
    });
  });

  describe('node management', () => {
    it('should add nodes to network', () => {
      blockchain.addNode('node1.example.com');
      expect(blockchain.getNodeCount()).toBe(1);
    });

    it('should add multiple nodes', () => {
      blockchain.addNode('node1.example.com');
      blockchain.addNode('node2.example.com');
      blockchain.addNode('node3.example.com');
      expect(blockchain.getNodeCount()).toBe(3);
    });

    it('should handle duplicate node additions', () => {
      blockchain.addNode('node1.example.com');
      blockchain.addNode('node1.example.com');
      expect(blockchain.getNodeCount()).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle large transaction amounts', () => {
      const result = blockchain.addTransaction('Alice', 'Bob', 999999999);
      expect(result).toBe(true);
    });

    it('should handle very long addresses', () => {
      const longAddr = 'a'.repeat(1000);
      const result = blockchain.addTransaction(longAddr, 'Bob', 50);
      expect(result).toBe(true);
    });

    it('should handle decimal amounts', () => {
      const result = blockchain.addTransaction('Alice', 'Bob', 50.5);
      expect(result).toBe(true);
    });

    it('should maintain chain integrity with 100 blocks', () => {
      for (let i = 0; i < 100; i++) {
        blockchain.addTransaction(`User${i}`, `User${i + 1}`, 1);
        blockchain.minePendingTransactions('Miner');
      }
      expect(blockchain.isChainValid()).toBe(true);
      expect(blockchain.getChainLength()).toBe(101);
    });
  });
});
