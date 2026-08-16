import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganizationIdToDataTables1787300000000 implements MigrationInterface {
  name = 'AddOrganizationIdToDataTables1787300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.dataSource.options.type === 'postgres';
    const defaultOrgId = 'org-platform-default';

    const tables = [
      { name: 'crm_leads', col: 'organization_id', idx: 'IDX_crm_leads_org' },
      { name: 'crm_notes', col: 'organization_id', idx: 'IDX_crm_notes_org' },
      { name: 'crm_tags', col: 'organization_id', idx: 'IDX_crm_tags_org' },
      { name: 'crm_followups', col: 'organization_id', idx: 'IDX_crm_followups_org' },
      { name: 'crm_activity', col: 'organization_id', idx: 'IDX_crm_activity_org' },
      { name: 'sessions', col: 'organizationId', idx: 'IDX_sessions_org' },
      { name: 'message_batches', col: 'organization_id', idx: 'IDX_message_batches_org' },
      { name: 'templates', col: 'organizationId', idx: 'IDX_templates_org' },
      { name: 'webhooks', col: 'organizationId', idx: 'IDX_webhooks_org' },
    ];

    for (const t of tables) {
      const tableExists = await queryRunner.hasTable(t.name);
      if (tableExists) {
        const hasCol = await queryRunner.hasColumn(t.name, t.col).catch(() => false);
        if (!hasCol) {
          if (isPostgres) {
            await queryRunner.query(`ALTER TABLE "${t.name}" ADD COLUMN "${t.col}" varchar(100)`).catch(() => {});
          } else {
            await queryRunner.query(`ALTER TABLE "${t.name}" ADD COLUMN "${t.col}" varchar(100)`).catch(() => {});
          }
        }

        // Add index
        await queryRunner.query(
          `CREATE INDEX IF NOT EXISTS "${t.idx}" ON "${t.name}" ("${t.col}")`,
        ).catch(() => {});

        // Safely backfill existing pre-Phase-4B records so no real data is lost or orphaned
        await queryRunner.query(
          `UPDATE "${t.name}" SET "${t.col}" = '${defaultOrgId}' WHERE "${t.col}" IS NULL`,
        ).catch(() => {});
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.dataSource.options.type === 'postgres';
    const tables = [
      'crm_leads',
      'crm_notes',
      'crm_tags',
      'crm_followups',
      'crm_activity',
      'sessions',
      'message_batches',
      'templates',
      'webhooks',
    ];

    for (const t of tables) {
      const tableExists = await queryRunner.hasTable(t);
      if (tableExists && isPostgres) {
        await queryRunner.query(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS "organization_id"`).catch(() => {});
      }
    }
  }
}
