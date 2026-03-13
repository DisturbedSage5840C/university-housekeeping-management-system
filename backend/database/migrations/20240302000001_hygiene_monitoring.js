/**
 * Migration: Campus Hygiene Monitoring System
 * Adds washrooms, work_submissions, supply_inventory, reminders tables
 * Updates users for supervisor role and shift tracking
 */

exports.up = async function (knex) {
    // 1. Add supervisor to users role enum and new columns
    await knex.raw(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
    await knex.raw(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'staff', 'supervisor', 'resident'))`);

    await knex.schema.alterTable('users', (table) => {
        table.string('shift', 20).defaultTo(null); // morning, evening, night
        table.uuid('supervisor_id').references('id').inTable('users').onDelete('SET NULL');
    });

    // 2. Washrooms table
    await knex.schema.createTable('washrooms', (table) => {
        table.increments('id').primary();
        table.string('building', 100).notNullable();
        table.integer('floor').notNullable();
        table.string('direction', 100); // e.g. "North Wing", "East", null
        table.string('label', 200); // e.g. "H2 Floor 1 North Wing"
        table.integer('soap_level').defaultTo(100); // percentage 0-100
        table.integer('tissue_level').defaultTo(100);
        table.integer('sanitizer_level').defaultTo(100);
        table.integer('freshener_level').defaultTo(100);
        table.enum('status', ['clean', 'needs-cleaning', 'in-progress', 'maintenance']).defaultTo('clean');
        table.timestamp('last_restocked');
        table.timestamp('last_cleaned');
        table.uuid('assigned_staff_id').references('id').inTable('users').onDelete('SET NULL');
        table.timestamps(true, true);

        table.index('building');
        table.index('status');
        table.index('assigned_staff_id');
    });

    // 3. Work submissions table (staff photo proof with 2-way verification)
    await knex.schema.createTable('work_submissions', (table) => {
        table.increments('id').primary();
        table.uuid('staff_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.integer('washroom_id').unsigned().references('id').inTable('washrooms').onDelete('CASCADE');
        table.string('building', 100).notNullable();
        table.integer('floor').notNullable();
        table.string('task_type', 50).notNullable(); // cleaning, restocking, maintenance
        table.text('notes');
        table.string('image_url', 500);
        // LLM verification
        table.boolean('llm_verified').defaultTo(false);
        table.float('llm_score').defaultTo(0); // 0.0 - 1.0 confidence
        table.text('llm_feedback');
        // Supervisor approval
        table.boolean('supervisor_approved').defaultTo(null);
        table.uuid('approved_by').references('id').inTable('users').onDelete('SET NULL');
        table.timestamp('approved_at');
        table.text('approval_notes');
        table.timestamps(true, true);

        table.index('staff_id');
        table.index('washroom_id');
        table.index('building');
        table.index(['llm_verified', 'supervisor_approved']);
        table.index('created_at');
    });

    // 4. Supply inventory table
    await knex.schema.createTable('supply_inventory', (table) => {
        table.increments('id').primary();
        table.string('building', 100).notNullable();
        table.string('item_name', 200).notNullable();
        table.integer('current_stock').defaultTo(0);
        table.integer('min_threshold').defaultTo(10);
        table.string('unit', 50).defaultTo('units'); // units, liters, rolls, etc.
        table.timestamp('last_refilled');
        table.uuid('last_refilled_by').references('id').inTable('users').onDelete('SET NULL');
        table.timestamps(true, true);

        table.index('building');
        table.index('current_stock');
    });

    // 5. Reminders table (supervisor consumption-based reminders)
    await knex.schema.createTable('reminders', (table) => {
        table.increments('id').primary();
        table.string('building', 100).notNullable();
        table.string('reminder_type', 50).notNullable(); // restocking, cleaning, refilling, inspection
        table.string('frequency', 20).notNullable(); // 4h, 8h, 12h, 24h
        table.boolean('notify_portal').defaultTo(true);
        table.boolean('notify_mobile').defaultTo(false);
        table.text('notes');
        table.uuid('created_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.timestamp('next_due');
        table.boolean('is_active').defaultTo(true);
        table.timestamps(true, true);

        table.index('building');
        table.index('created_by');
        table.index('is_active');
        table.index('next_due');
    });

    // 6. Add building column to complaints for building-level tracking
    // Also widen room_number to accommodate longer washroom location strings
    await knex.schema.alterTable('complaints', (table) => {
        table.string('building', 100);
    });
    await knex.raw('ALTER TABLE complaints ALTER COLUMN room_number TYPE varchar(200)');

    // 7. Also widen room_number on rooms and users tables for consistency
    await knex.raw('ALTER TABLE rooms ALTER COLUMN room_number TYPE varchar(200)');
    await knex.raw('ALTER TABLE users ALTER COLUMN room_number TYPE varchar(200)');
};

exports.down = async function (knex) {
    await knex.schema.alterTable('complaints', (table) => {
        table.dropColumn('building');
    });

    await knex.schema.dropTableIfExists('reminders');
    await knex.schema.dropTableIfExists('supply_inventory');
    await knex.schema.dropTableIfExists('work_submissions');
    await knex.schema.dropTableIfExists('washrooms');

    await knex.schema.alterTable('users', (table) => {
        table.dropColumn('shift');
        table.dropColumn('supervisor_id');
    });

    await knex.raw(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
    await knex.raw(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'staff', 'resident'))`);
};
