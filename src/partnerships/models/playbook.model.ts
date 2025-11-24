// src/partnerships/models/playbook.model.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Execution } from './execution.model';

export enum TriggerType {
  CRON = 'cron',
  WEBHOOK = 'webhook',
  MANUAL = 'manual',
  EVENT = 'event'
}

export enum StepAction {
  QUERY = 'query',
  EVALUATE = 'evaluate',
  TEMPLATE = 'template',
  COMMUNICATE = 'communicate',
  WEBHOOK = 'webhook'
}

export enum ErrorHandling {
  RETRY = 'retry',
  SKIP = 'skip',
  ABORT = 'abort'
}

export interface WorkflowStep {
  id: string;
  action: StepAction;
  connector?: string;
  config: Record<string, any>;
  dependencies?: string[];
  errorHandler?: ErrorHandling;
  maxRetries?: number;
  timeout?: number;
}

@Entity('playbooks')
export class Playbook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: TriggerType })
  trigger: TriggerType;

  @Column({ type: 'jsonb' })
  steps: WorkflowStep[];

  @Column({ type: 'enum', enum: ErrorHandling, default: ErrorHandling.RETRY })
  errorHandling: ErrorHandling;

  @Column({ default: 3 })
  maxRetries: number;

  @Column({ default: 300000 })
  timeout: number;

  @Column()
  owner: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Execution, execution => execution.playbook)
  executions: Execution[];
}
