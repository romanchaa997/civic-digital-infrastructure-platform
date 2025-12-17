/**
 * ARPANET-Inspired Distributed Networking
 * Packet-switching networks enabled resilient, distributed information sharing
 * that transformed worldwide digital connectivity
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';

interface NetworkNode {
  id: string;
  address: string;
  connected: boolean;
  neighbors: string[];
  packetBuffer: Packet[];
  latency: number; // milliseconds
}

interface Packet {
  id: string;
  source: string;
  destination: string;
  payload: Buffer;
  createdAt: Date;
  routePath: string[];
  ttl: number; // time to live
}

interface RouteInfo {
  destination: string;
  nextHop: string;
  cost: number;
  timestamp: Date;
}

export class ARPANETDistributedNetwork extends EventEmitter {
  private logger: Logger;
  private nodes: Map<string, NetworkNode> = new Map();
  private routingTable: Map<string, RouteInfo> = new Map();
  private packetQueue: Packet[] = [];
  private maxRetries: number = 5;

  constructor() {
    super();
    this.logger = new Logger('ARPANETDistributedNetwork');
    this.initializeNetwork();
  }

  /**
   * Register a node in the network
   */
  public registerNode(node: NetworkNode): void {
    this.nodes.set(node.id, node);
    this.logger.info(`Node registered: ${node.id} at ${node.address}`);
    this.emit('nodeRegistered', node);
    this.rebuildRoutingTable();
  }

  /**
   * Connect two nodes in the network
   */
  public connectNodes(nodeId1: string, nodeId2: string): void {
    const node1 = this.nodes.get(nodeId1);
    const node2 = this.nodes.get(nodeId2);

    if (!node1 || !node2) {
      throw new Error('One or both nodes not found');
    }

    if (!node1.neighbors.includes(nodeId2)) {
      node1.neighbors.push(nodeId2);
    }
    if (!node2.neighbors.includes(nodeId1)) {
      node2.neighbors.push(nodeId1);
    }

    this.logger.info(`Nodes connected: ${nodeId1} <-> ${nodeId2}`);
    this.emit('nodesConnected', { node1: nodeId1, node2: nodeId2 });
    this.rebuildRoutingTable();
  }

  /**
   * Send a packet using packet-switching
   */
  public async sendPacket(
    source: string,
    destination: string,
    payload: Buffer
  ): Promise<void> {
    const packet: Packet = {
      id: `pkt-${Date.now()}`,
      source,
      destination,
      payload,
      createdAt: new Date(),
      routePath: [source],
      ttl: 255
    };

    this.logger.debug(`Packet created: ${packet.id}`);
    this.packetQueue.push(packet);
    this.emit('packetSent', packet);

    await this.routePacket(packet);
  }

  /**
   * Route packet through network using optimal path
   */
  private async routePacket(packet: Packet): Promise<void> {
    let currentNode = packet.source;
    let hops = 0;
    const maxHops = 30;

    while (currentNode !== packet.destination && hops < maxHops && packet.ttl > 0) {
      const nextHop = this.findNextHop(currentNode, packet.destination);

      if (!nextHop) {
        this.logger.warn(`No route found for packet ${packet.id}`);
        this.emit('packetLost', { packet, reason: 'noRoute' });
        return;
      }

      packet.routePath.push(nextHop);
      packet.ttl--;
      hops++;

      // Simulate network latency
      const nextNode = this.nodes.get(nextHop);
      if (nextNode) {
        await new Promise(resolve => setTimeout(resolve, nextNode.latency));
      }

      currentNode = nextHop;
    }

    if (currentNode === packet.destination) {
      this.logger.info(`Packet ${packet.id} delivered in ${hops} hops`);
      this.emit('packetDelivered', { packet, hops });
    } else {
      this.logger.warn(`Packet ${packet.id} delivery failed (TTL exceeded)`);
      this.emit('packetLost', { packet, reason: 'ttlExceeded' });
    }
  }

  /**
   * Find optimal next hop using Dijkstra's algorithm
   */
  private findNextHop(currentNode: string, destination: string): string | null {
    const node = this.nodes.get(currentNode);
    if (!node) return null;

    // Use breadth-first search for available neighbors
    const activeNeighbors = node.neighbors.filter(n => {
      const neighbor = this.nodes.get(n);
      return neighbor && neighbor.connected;
    });

    if (activeNeighbors.length === 0) return null;

    // Prioritize shorter paths using routing table
    return activeNeighbors.sort((a, b) => {
      const costA = this.getRouteCost(a, destination);
      const costB = this.getRouteCost(b, destination);
      return costA - costB;
    })[0];
  }

  /**
   * Get route cost to destination
   */
  private getRouteCost(node: string, destination: string): number {
    const routeKey = `${node}->${destination}`;
    const route = this.routingTable.get(routeKey);
    return route ? route.cost : Infinity;
  }

  /**
   * Handle network failures and reroute packets
   */
  public async handleNodeFailure(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    node.connected = false;
    this.logger.warn(`Node ${nodeId} failed`);
    this.emit('nodeFailure', { nodeId });

    // Reroute affected packets
    this.rebuildRoutingTable();
    this.emit('networkReconfigured', { failedNode: nodeId });
  }

  /**
   * Rebuild routing table using SPF (Shortest Path First) algorithm
   */
  private rebuildRoutingTable(): void {
    this.routingTable.clear();

    for (const [sourceId] of this.nodes) {
      const distances: Map<string, number> = new Map();
      const visited: Set<string> = new Set();

      // Initialize distances
      for (const [nodeId] of this.nodes) {
        distances.set(nodeId, nodeId === sourceId ? 0 : Infinity);
      }

      // Dijkstra's algorithm
      while (visited.size < this.nodes.size) {
        let minDistance = Infinity;
        let minNode: string | null = null;

        for (const [nodeId, distance] of distances) {
          if (!visited.has(nodeId) && distance < minDistance) {
            minDistance = distance;
            minNode = nodeId;
          }
        }

        if (minNode === null) break;
        visited.add(minNode);

        const currentNode = this.nodes.get(minNode)!;
        for (const neighbor of currentNode.neighbors) {
          const newDistance = minDistance + 1;
          if (newDistance < (distances.get(neighbor) || Infinity)) {
            distances.set(neighbor, newDistance);
          }
        }
      }

      // Store routing table entries
      for (const [destId, cost] of distances) {
        if (destId !== sourceId) {
          const routeKey = `${sourceId}->${destId}`;
          this.routingTable.set(routeKey, {
            destination: destId,
            nextHop: this.findBestNeighbor(sourceId, destId) || '',
            cost: cost === Infinity ? cost : cost,
            timestamp: new Date()
          });
        }
      }
    }

    this.logger.debug('Routing table rebuilt');
  }

  /**
   * Find best neighbor towards destination
   */
  private findBestNeighbor(source: string, destination: string): string | null {
    const node = this.nodes.get(source);
    if (!node) return null;

    for (const neighbor of node.neighbors) {
      const neighborNode = this.nodes.get(neighbor);
      if (neighborNode && neighborNode.connected) {
        return neighbor;
      }
    }
    return null;
  }

  /**
   * Get network statistics
   */
  public getNetworkStats(): any {
    const activeNodes = Array.from(this.nodes.values()).filter(n => n.connected).length;
    const totalNodes = this.nodes.size;
    const totalConnections = Array.from(this.nodes.values())
      .reduce((sum, node) => sum + node.neighbors.length, 0) / 2;

    return {
      activeNodes,
      totalNodes,
      totalConnections,
      packetQueueLength: this.packetQueue.length,
      routingTableSize: this.routingTable.size
    };
  }

  private initializeNetwork(): void {
    this.logger.info('ARPANET-style distributed network initialized');
  }
}

export default new ARPANETDistributedNetwork();
