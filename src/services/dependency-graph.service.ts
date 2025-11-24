import { DependencyGraph, DependencyNode, DependencyEdge } from '../models';

/**
 * DependencyGraphService analyzes code dependencies and generates
 * visual dependency graphs for audit reports and visualization.
 * 
 * Features:
 * - Build dependency graphs from source code analysis
 * - Detect circular dependencies and vulnerability chains
 * - Generate graph visualizations (JSON, DOT format)
 * - Export graphs for external visualization tools
 */
class DependencyGraphService {
  /**
   * Parse dependencies from audit results
   * @param sourceCode - Source code to analyze
   * @param packages - List of packages/dependencies
   * @returns Dependency graph structure
   */
  parseDependencies(
    sourceCode: string,
    packages: Array<{ name: string; version: string }>
  ): DependencyGraph {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];

    // Create nodes for each package
    packages.forEach((pkg, index) => {
      nodes.push({
        id: pkg.name,
        label: `${pkg.name}@${pkg.version}`,
        version: pkg.version,
        vulnerable: this.checkVulnerability(pkg.name, pkg.version),
        criticalityScore: 0,
      });
    });

    // Analyze import statements to build edges
    const importRegex = /(?:import|require)\s+(?:{[^}]*}|\*\s+as\s+\w+|[\w$]+)\s+from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;

    while ((match = importRegex.exec(sourceCode)) !== null) {
      const dependency = match[1] || match[2];
      const mainPackage = this.extractPackageName(dependency);

      if (packages.some((p) => p.name === mainPackage)) {
        edges.push({
          source: 'root',
          target: mainPackage,
          weight: 1,
          isCircular: false,
        });
      }
    }

    // Calculate circularity and criticality
    this.detectCircularDependencies(edges, nodes);
    this.calculateCriticality(nodes, edges);

    return {
      nodes,
      edges,
      statistics: this.generateStatistics(nodes, edges),
    };
  }

  /**
   * Extract package name from import path
   * @param importPath - Full import path
   * @returns Package name
   */
  private extractPackageName(importPath: string): string {
    if (importPath.startsWith('.')) return 'local';
    const parts = importPath.split('/');
    return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
  }

  /**
   * Check if a package version is vulnerable
   * @param packageName - Package name
   * @param version - Package version
   * @returns Vulnerability status
   */
  private checkVulnerability(packageName: string, version: string): boolean {
    // This would integrate with vulnerability databases like npm audit
    // For now, return false - actual implementation would check CVE databases
    return false;
  }

  /**
   * Detect circular dependencies in the graph
   * @param edges - Graph edges
   * @param nodes - Graph nodes
   */
  private detectCircularDependencies(edges: DependencyEdge[], nodes: DependencyNode[]): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const dependencies = edges
        .filter((e) => e.source === nodeId)
        .map((e) => e.target);

      for (const dep of dependencies) {
        if (!visited.has(dep)) {
          if (hasCycle(dep)) return true;
        } else if (recursionStack.has(dep)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    nodes.forEach((node) => {
      if (!visited.has(node.id)) {
        if (hasCycle(node.id)) {
          // Mark edges involved in cycle
          edges.forEach((edge) => {
            edge.isCircular = true;
          });
        }
      }
    });
  }

  /**
   * Calculate criticality score for each node
   * @param nodes - Graph nodes
   * @param edges - Graph edges
   */
  private calculateCriticality(nodes: DependencyNode[], edges: DependencyEdge[]): void {
    nodes.forEach((node) => {
      const incomingEdges = edges.filter((e) => e.target === node.id).length;
      const outgoingEdges = edges.filter((e) => e.source === node.id).length;
      const circularEdges = edges.filter(
        (e) => (e.source === node.id || e.target === node.id) && e.isCircular
      ).length;

      node.criticalityScore = (incomingEdges * 0.5 + outgoingEdges * 0.3 + circularEdges * 2) / 10;
    });
  }

  /**
   * Generate graph statistics
   * @param nodes - Graph nodes
   * @param edges - Graph edges
   * @returns Graph statistics
   */
  private generateStatistics(
    nodes: DependencyNode[],
    edges: DependencyEdge[]
  ): Record<string, number> {
    const circularDeps = edges.filter((e) => e.isCircular).length;
    const vulnerableDeps = nodes.filter((n) => n.vulnerable).length;
    const totalWeight = edges.reduce((sum, e) => sum + e.weight, 0);

    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      circularDependencies: circularDeps,
      vulnerableDependencies: vulnerableDeps,
      averageWeight: edges.length > 0 ? totalWeight / edges.length : 0,
      maxCriticality: Math.max(...nodes.map((n) => n.criticalityScore), 0),
    };
  }

  /**
   * Export graph as DOT format for Graphviz
   * @param graph - Dependency graph
   * @returns DOT format string
   */
  exportAsDot(graph: DependencyGraph): string {
    let dot = 'digraph DependencyGraph {\n';
    dot += '  rankdir=LR;\n';
    dot += '  node [shape=box];\n';

    // Add nodes
    graph.nodes.forEach((node) => {
      const color = node.vulnerable ? 'red' : node.criticalityScore > 0.7 ? 'orange' : 'lightblue';
      dot += `  "${node.id}" [label="${node.label}", fillcolor="${color}", style=filled];\n`;
    });

    // Add edges
    graph.edges.forEach((edge) => {
      const style = edge.isCircular ? 'dashed' : 'solid';
      dot += `  "${edge.source}" -> "${edge.target}" [style="${style}", weight=${edge.weight}];\n`;
    });

    dot += '}\n';
    return dot;
  }

  /**
   * Export graph as JSON
   * @param graph - Dependency graph
   * @returns JSON representation
   */
  exportAsJson(graph: DependencyGraph): string {
    return JSON.stringify(graph, null, 2);
  }

  /**
   * Get vulnerability risk assessment
   * @param graph - Dependency graph
   * @returns Risk assessment report
   */
  getRiskAssessment(graph: DependencyGraph): {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    vulnerableNodes: string[];
    circularChains: string[][];
    recommendations: string[];
  } {
    const vulnerableNodes = graph.nodes.filter((n) => n.vulnerable).map((n) => n.id);
    const circularEdges = graph.edges.filter((e) => e.isCircular);
    const criticalNodes = graph.nodes.filter((n) => n.criticalityScore > 0.7).map((n) => n.id);

    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (vulnerableNodes.length > 0) riskLevel = 'high';
    if (circularEdges.length > 0) riskLevel = 'medium';
    if (vulnerableNodes.length > 0 && circularEdges.length > 0) riskLevel = 'critical';

    const recommendations: string[] = [];
    if (vulnerableNodes.length > 0) {
      recommendations.push(
        `Update vulnerable dependencies: ${vulnerableNodes.join(', ')}`
      );
    }
    if (circularEdges.length > 0) {
      recommendations.push('Refactor code to eliminate circular dependencies');
    }
    if (criticalNodes.length > 0) {
      recommendations.push(
        `Consider reducing dependencies on critical packages: ${criticalNodes.join(', ')}`
      );
    }

    return {
      riskLevel,
      vulnerableNodes,
      circularChains: [],
      recommendations,
    };
  }
}

// Export singleton instance
export const dependencyGraphService = new DependencyGraphService();
export { DependencyGraphService };
