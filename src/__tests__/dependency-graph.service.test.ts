import { describe, it, expect, beforeEach } from '@jest/globals';

interface Node {
  id: string;
  name: string;
  version: string;
  dependencies: Set<string>;
}

interface Graph {
  nodes: Map<string, Node>;
  edges: Map<string, Set<string>>;
}

class DependencyGraphService {
  private graph: Graph = {
    nodes: new Map(),
    edges: new Map()
  };
  private sortCache: string[] | null = null;

  addNode(id: string, name: string, version: string = '1.0.0'): void {
    const node: Node = {
      id,
      name,
      version,
      dependencies: new Set()
    };
    this.graph.nodes.set(id, node);
    this.invalidateCache();
  }

  addDependency(fromId: string, toId: string): boolean {
    if (!this.graph.nodes.has(fromId) || !this.graph.nodes.has(toId)) {
      return false;
    }
    if (!this.graph.edges.has(fromId)) {
      this.graph.edges.set(fromId, new Set());
    }
    this.graph.edges.get(fromId)!.add(toId);
    const fromNode = this.graph.nodes.get(fromId)!;
    fromNode.dependencies.add(toId);
    this.invalidateCache();
    return true;
  }

  getNodeDependencies(id: string): string[] {
    if (!this.graph.nodes.has(id)) return [];
    return Array.from(this.graph.nodes.get(id)!.dependencies);
  }

  getTransitiveDependencies(id: string): Set<string> {
    const result = new Set<string>();
    const visited = new Set<string>();
    const queue = [id];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const node = this.graph.nodes.get(current);
      if (node) {
        node.dependencies.forEach(dep => {
          result.add(dep);
          if (!visited.has(dep)) {
            queue.push(dep);
          }
        });
      }
    }
    return result;
  }

  hasCycle(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const nodeId of this.graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (this.hasCycleDFS(nodeId, visited, recursionStack)) {
          return true;
        }
      }
    }
    return false;
  }

  private hasCycleDFS(nodeId: string, visited: Set<string>, recursionStack: Set<string>): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const node = this.graph.nodes.get(nodeId);
    if (node) {
      for (const dep of node.dependencies) {
        if (!visited.has(dep)) {
          if (this.hasCycleDFS(dep, visited, recursionStack)) {
            return true;
          }
        } else if (recursionStack.has(dep)) {
          return true;
        }
      }
    }
    recursionStack.delete(nodeId);
    return false;
  }

  topologicalSort(): string[] {
    if (this.sortCache !== null) return this.sortCache;
    if (this.hasCycle()) return [];

    const visited = new Set<string>();
    const stack: string[] = [];

    const dfs = (nodeId: string) => {
      visited.add(nodeId);
      const node = this.graph.nodes.get(nodeId);
      if (node) {
        node.dependencies.forEach(dep => {
          if (!visited.has(dep)) dfs(dep);
        });
      }
      stack.push(nodeId);
    };

    for (const nodeId of this.graph.nodes.keys()) {
      if (!visited.has(nodeId)) dfs(nodeId);
    }

    this.sortCache = stack.reverse();
    return this.sortCache;
  }

  getNodeCount(): number {
    return this.graph.nodes.size;
  }

  getEdgeCount(): number {
    let count = 0;
    for (const edges of this.graph.edges.values()) {
      count += edges.size;
    }
    return count;
  }

  isReachable(fromId: string, toId: string): boolean {
    const transitive = this.getTransitiveDependencies(fromId);
    return transitive.has(toId);
  }

  private invalidateCache(): void {
    this.sortCache = null;
  }

  getNode(id: string): Node | undefined {
    return this.graph.nodes.get(id);
  }
}

describe('DependencyGraphService', () => {
  let depGraph: DependencyGraphService;

  beforeEach(() => {
    depGraph = new DependencyGraphService();
  });

  describe('node management', () => {
    it('should add nodes to graph', () => {
      depGraph.addNode('app', 'My App');
      expect(depGraph.getNodeCount()).toBe(1);
    });

    it('should retrieve added nodes', () => {
      depGraph.addNode('lib', 'Library', '2.1.0');
      const node = depGraph.getNode('lib');
      expect(node).toBeDefined();
      expect(node?.name).toBe('Library');
      expect(node?.version).toBe('2.1.0');
    });

    it('should add multiple nodes', () => {
      depGraph.addNode('app', 'App');
      depGraph.addNode('auth', 'Auth Module');
      depGraph.addNode('db', 'Database');
      expect(depGraph.getNodeCount()).toBe(3);
    });

    it('should have default version 1.0.0', () => {
      depGraph.addNode('pkg', 'Package');
      const node = depGraph.getNode('pkg');
      expect(node?.version).toBe('1.0.0');
    });
  });

  describe('dependency management', () => {
    beforeEach(() => {
      depGraph.addNode('app', 'App');
      depGraph.addNode('auth', 'Auth');
      depGraph.addNode('db', 'DB');
    });

    it('should add dependencies between nodes', () => {
      const result = depGraph.addDependency('app', 'auth');
      expect(result).toBe(true);
      const deps = depGraph.getNodeDependencies('app');
      expect(deps).toContain('auth');
    });

    it('should reject dependency to non-existent node', () => {
      const result = depGraph.addDependency('app', 'nonexistent');
      expect(result).toBe(false);
    });

    it('should handle multiple dependencies', () => {
      depGraph.addDependency('app', 'auth');
      depGraph.addDependency('app', 'db');
      const deps = depGraph.getNodeDependencies('app');
      expect(deps).toContain('auth');
      expect(deps).toContain('db');
      expect(deps.length).toBe(2);
    });

    it('should track edge count correctly', () => {
      depGraph.addDependency('app', 'auth');
      depGraph.addDependency('app', 'db');
      depGraph.addDependency('auth', 'db');
      expect(depGraph.getEdgeCount()).toBe(3);
    });
  });

  describe('transitive dependencies', () => {
    beforeEach(() => {
      depGraph.addNode('app', 'App');
      depGraph.addNode('auth', 'Auth');
      depGraph.addNode('db', 'DB');
      depGraph.addNode('cache', 'Cache');
    });

    it('should find direct dependencies', () => {
      depGraph.addDependency('app', 'auth');
      const transitive = depGraph.getTransitiveDependencies('app');
      expect(transitive.has('auth')).toBe(true);
    });

    it('should find transitive dependencies', () => {
      depGraph.addDependency('app', 'auth');
      depGraph.addDependency('auth', 'db');
      const transitive = depGraph.getTransitiveDependencies('app');
      expect(transitive.has('auth')).toBe(true);
      expect(transitive.has('db')).toBe(true);
    });

    it('should handle deep dependency chains', () => {
      depGraph.addDependency('app', 'auth');
      depGraph.addDependency('auth', 'db');
      depGraph.addDependency('db', 'cache');
      const transitive = depGraph.getTransitiveDependencies('app');
      expect(transitive.size).toBe(3);
    });
  });

  describe('cycle detection', () => {
    it('should detect no cycle in valid graph', () => {
      depGraph.addNode('a', 'A');
      depGraph.addNode('b', 'B');
      depGraph.addNode('c', 'C');
      depGraph.addDependency('a', 'b');
      depGraph.addDependency('b', 'c');
      expect(depGraph.hasCycle()).toBe(false);
    });

    it('should detect self-cycle', () => {
      depGraph.addNode('a', 'A');
      depGraph.addDependency('a', 'a');
      expect(depGraph.hasCycle()).toBe(true);
    });

    it('should detect two-node cycle', () => {
      depGraph.addNode('a', 'A');
      depGraph.addNode('b', 'B');
      depGraph.addDependency('a', 'b');
      depGraph.addDependency('b', 'a');
      expect(depGraph.hasCycle()).toBe(true);
    });

    it('should detect complex cycles', () => {
      depGraph.addNode('a', 'A');
      depGraph.addNode('b', 'B');
      depGraph.addNode('c', 'C');
      depGraph.addDependency('a', 'b');
      depGraph.addDependency('b', 'c');
      depGraph.addDependency('c', 'a');
      expect(depGraph.hasCycle()).toBe(true);
    });
  });

  describe('topological sorting', () => {
    beforeEach(() => {
      depGraph.addNode('app', 'App');
      depGraph.addNode('auth', 'Auth');
      depGraph.addNode('db', 'DB');
      depGraph.addNode('cache', 'Cache');
    });

    it('should sort acyclic graph', () => {
      depGraph.addDependency('app', 'auth');
      depGraph.addDependency('auth', 'db');
      const sorted = depGraph.topologicalSort();
      expect(sorted.length).toBe(4);
    });

    it('should return empty array for cyclic graph', () => {
      depGraph.addDependency('app', 'auth');
      depGraph.addDependency('auth', 'app');
      const sorted = depGraph.topologicalSort();
      expect(sorted.length).toBe(0);
    });

    it('should maintain cache for repeated calls', () => {
      depGraph.addDependency('app', 'auth');
      const sort1 = depGraph.topologicalSort();
      const sort2 = depGraph.topologicalSort();
      expect(sort1).toBe(sort2);
    });
  });

  describe('reachability', () => {
    beforeEach(() => {
      depGraph.addNode('a', 'A');
      depGraph.addNode('b', 'B');
      depGraph.addNode('c', 'C');
    });

    it('should determine reachability', () => {
      depGraph.addDependency('a', 'b');
      expect(depGraph.isReachable('a', 'b')).toBe(true);
      expect(depGraph.isReachable('b', 'a')).toBe(false);
    });

    it('should find transitive reachability', () => {
      depGraph.addDependency('a', 'b');
      depGraph.addDependency('b', 'c');
      expect(depGraph.isReachable('a', 'c')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty graph', () => {
      expect(depGraph.getNodeCount()).toBe(0);
      expect(depGraph.getEdgeCount()).toBe(0);
      expect(depGraph.hasCycle()).toBe(false);
    });

    it('should handle isolated nodes', () => {
      depGraph.addNode('isolated', 'Isolated');
      const sorted = depGraph.topologicalSort();
      expect(sorted).toContain('isolated');
    });

    it('should handle large graph', () => {
      for (let i = 0; i < 100; i++) {
        depGraph.addNode(`node${i}`, `Node ${i}`);
      }
      for (let i = 0; i < 99; i++) {
        depGraph.addDependency(`node${i}`, `node${i + 1}`);
      }
      expect(depGraph.hasCycle()).toBe(false);
      expect(depGraph.getNodeCount()).toBe(100);
    });
  });
});
