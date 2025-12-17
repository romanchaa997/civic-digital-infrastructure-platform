/**
 * Parallel Execution Engine
 * High-speed development framework enabling accelerated parallel task execution
 * with quality assurance and performance optimization
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';

interface Task {
  id: string;
  name: string;
  fn: () => Promise<any>;
  priority: 'critical' | 'high' | 'medium' | 'low';
  timeout: number;
  retries: number;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: Error;
  startTime?: number;
  endTime?: number;
}

interface ExecutionPool {
  maxConcurrency: number;
  activeCount: number;
  queue: Task[];
  results: Map<string, any>;
}

interface PerformanceMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalTime: number;
  averageTaskTime: number;
  throughput: number; // tasks per second
  errorRate: number; // percentage
}

export class ParallelExecutionEngine extends EventEmitter {
  private logger: Logger;
  private pool: ExecutionPool;
  private taskMap: Map<string, Task> = new Map();
  private metrics: PerformanceMetrics;

  constructor(maxConcurrency: number = 8) {
    super();
    this.logger = new Logger('ParallelExecutionEngine');
    this.pool = {
      maxConcurrency,
      activeCount: 0,
      queue: [],
      results: new Map()
    };
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      totalTime: 0,
      averageTaskTime: 0,
      throughput: 0,
      errorRate: 0
    };
  }

  /**
   * Register a task for parallel execution
   */
  public registerTask(task: Omit<Task, 'status' | 'result' | 'error'>): string {
    const fullTask: Task = {
      ...task,
      status: 'pending'
    };
    this.taskMap.set(task.id, fullTask);
    this.pool.queue.push(fullTask);
    this.metrics.totalTasks++;
    this.logger.debug(`Task registered: ${task.name} (priority: ${task.priority})`);
    return task.id;
  }

  /**
   * Execute all registered tasks in parallel
   */
  public async executeParallel(): Promise<Map<string, any>> {
    try {
      const startTime = Date.now();
      this.logger.info(`Starting parallel execution of ${this.pool.queue.length} tasks`);

      // Sort by priority
      this.pool.queue.sort((a, b) => {
        const priorityMap = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityMap[a.priority] - priorityMap[b.priority];
      });

      // Execute with concurrency control
      while (this.pool.queue.length > 0 || this.pool.activeCount > 0) {
        // Fill the pool up to max concurrency
        while (this.pool.activeCount < this.pool.maxConcurrency && this.pool.queue.length > 0) {
          const task = this.pool.queue.shift()!;
          this.executeTask(task);
        }

        // Wait for at least one task to complete
        if (this.pool.activeCount > 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      const totalTime = Date.now() - startTime;
      this.metrics.totalTime = totalTime;
      this.calculateMetrics();

      this.logger.info(`Parallel execution completed in ${totalTime}ms`);
      this.emit('executionComplete', {
        results: this.pool.results,
        metrics: this.metrics
      });

      return this.pool.results;
    } catch (error) {
      this.logger.error('Parallel execution failed', error);
      throw error;
    }
  }

  /**
   * Execute a single task with retry logic
   */
  private async executeTask(task: Task): Promise<void> {
    task.status = 'running';
    task.startTime = Date.now();
    this.pool.activeCount++;
    this.emit('taskStarted', { taskId: task.id, name: task.name });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= task.retries; attempt++) {
      try {
        const result = await Promise.race([
          task.fn(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Task timeout')), task.timeout)
          )
        ]);

        task.status = 'completed';
        task.result = result;
        task.endTime = Date.now();
        this.pool.results.set(task.id, result);
        this.metrics.completedTasks++;
        this.emit('taskCompleted', {
          taskId: task.id,
          name: task.name,
          duration: task.endTime - task.startTime!
        });
        break;
      } catch (error) {
        lastError = error as Error;
        if (attempt < task.retries) {
          this.logger.warn(`Task ${task.name} attempt ${attempt + 1} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
        }
      }
    }

    if (task.status === 'running') {
      task.status = 'failed';
      task.error = lastError || new Error('Unknown error');
      task.endTime = Date.now();
      this.metrics.failedTasks++;
      this.logger.error(`Task ${task.name} failed after ${task.retries + 1} attempts`);
      this.emit('taskFailed', {
        taskId: task.id,
        name: task.name,
        error: lastError
      });
    }

    this.pool.activeCount--;
  }

  /**
   * Calculate performance metrics
   */
  private calculateMetrics(): void {
    const completedTasks = Array.from(this.taskMap.values()).filter(
      t => t.status === 'completed'
    );
    const totalDuration = completedTasks.reduce(
      (sum, t) => sum + ((t.endTime || 0) - (t.startTime || 0)),
      0
    );

    this.metrics.averageTaskTime =
      completedTasks.length > 0 ? totalDuration / completedTasks.length : 0;
    this.metrics.throughput =
      (this.metrics.completedTasks / this.metrics.totalTime) * 1000;
    this.metrics.errorRate =
      (this.metrics.failedTasks / this.metrics.totalTasks) * 100;
  }

  /**
   * Get execution metrics
   */
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get task status
   */
  public getTaskStatus(taskId: string): Task | undefined {
    return this.taskMap.get(taskId);
  }

  /**
   * Reset the engine for new execution cycle
   */
  public reset(): void {
    this.taskMap.clear();
    this.pool.queue = [];
    this.pool.results.clear();
    this.pool.activeCount = 0;
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      totalTime: 0,
      averageTaskTime: 0,
      throughput: 0,
      errorRate: 0
    };
    this.logger.info('Execution engine reset');
  }

  /**
   * Get all task results
   */
  public getResults(): Map<string, any> {
    return new Map(this.pool.results);
  }
}

export default new ParallelExecutionEngine(8);
