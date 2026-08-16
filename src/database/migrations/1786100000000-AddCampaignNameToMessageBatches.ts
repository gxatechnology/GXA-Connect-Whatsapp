import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCampaignNameToMessageBatches1786100000000 implements MigrationInterface {
  name = 'AddCampaignNameToMessageBatches1786100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('message_batches', 'campaign_name')) return;
    await queryRunner.addColumn(
      'message_batches',
      new TableColumn({ name: 'campaign_name', type: 'varchar', length: '160', isNullable: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('message_batches', 'campaign_name'))) return;
    await queryRunner.dropColumn('message_batches', 'campaign_name');
  }
}
