/**
 * Migration: Supervisor washroom checklist and passive 2-hour reminders
 */

exports.up = async function up(knex) {
    await knex.schema.createTable('washroom_checklists', (table) => {
        table.increments('id').primary();
        table.integer('washroom_id').unsigned().notNullable().references('id').inTable('washrooms').onDelete('CASCADE');
        table.uuid('supervisor_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.date('checklist_date').notNullable().defaultTo(knex.raw('CURRENT_DATE'));
        table.jsonb('checklist_items').notNullable();
        table.text('notes');
        table.timestamp('submitted_at').notNullable().defaultTo(knex.fn.now());
        table.timestamps(true, true);

        table.index('washroom_id');
        table.index('supervisor_id');
        table.index('checklist_date');
        table.index('submitted_at');
    });

    await knex.schema.createTable('supervisor_check_reminders', (table) => {
        table.uuid('supervisor_id').primary().references('id').inTable('users').onDelete('CASCADE');
        table.timestamp('next_due').notNullable().defaultTo(knex.raw("NOW() + INTERVAL '2 hour'"));
        table.timestamp('last_sent_at');
        table.boolean('is_active').notNullable().defaultTo(true);
        table.timestamps(true, true);

        table.index('next_due');
        table.index('is_active');
    });

    await knex.raw(`
        INSERT INTO supervisor_check_reminders (supervisor_id, next_due, is_active, created_at, updated_at)
        SELECT id, NOW() + INTERVAL '2 hour', true, NOW(), NOW()
        FROM users
        WHERE role = 'supervisor' AND is_active = true
        ON CONFLICT (supervisor_id) DO NOTHING
    `);
};

exports.down = async function down(knex) {
    await knex.schema.dropTableIfExists('supervisor_check_reminders');
    await knex.schema.dropTableIfExists('washroom_checklists');
};
