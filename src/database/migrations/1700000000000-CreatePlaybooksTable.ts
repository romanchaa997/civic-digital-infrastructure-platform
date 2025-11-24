import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreatePlaybooksTable1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'playbooks',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()'
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true
          },
          {
            name: 'trigger',
            type: 'enum',
            enum: ['cron', 'webhook', 'manual', 'event'],
            default: "'manual'"
          },
          {
            name: 'trigger_config',
            type: 'jsonb',
            isNullable: false,
            default: "'{}'::jsonb"
          },
          {
            name: 'steps',
            type: 'jsonb',
            isNullable: false,
            default: "'[]'::jsonb"
          },
          {
            name: 'error_handling',
            type: 'enum',
            enum: ['retry', 'skip', 'abort'],
            default: "'retry'"
          },
          {
            name: 'max_retries',
            type: 'int',
            default: 3
          },
          {
            name: 'timeout',
            type: 'int',
            default: 300000,
            comment: 'Timeout in milliseconds'
          },
          {
            name: 'tags',
            type: 'text',
            isArray: true,
            isNullable: true
          },
          {
            name: 'owner',
            type: 'varchar',
            length: '255',
            isNullable: false
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true
          },
          {
            name: 'allowed_roles',
            type: 'text',
            isArray: true,
            isNullable: true
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP'
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP'
          },
          {
            name: 'last_executed_at',
            type: 'timestamp',
            isNullable: true
          }
        ],
        indices: [
          new TableIndex({ columnNames: ['owner'] }),
          new TableIndex({ columnNames: ['trigger'] }),
          new TableIndex({ columnNames: ['is_active'] }),
          new TableIndex({ columnNames: ['created_at'] })
        ]
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('playbooks');
  }
}
