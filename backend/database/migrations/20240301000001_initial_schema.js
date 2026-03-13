/**
 * Database Migration: Initial Schema
 * Creates all tables for ILGC Tracker
 */

exports.up = function (knex) {
    return knex.schema
        // Users table
        .createTable('users', (table) => {
            table.uuid('id').primary().defaultTo(knex.fn.uuid());
            table.string('email', 255).unique().notNullable();
            table.string('password', 255).notNullable();
            table.string('name', 255).notNullable();
            table.enum('role', ['admin', 'staff', 'resident']).notNullable();
            table.string('room_number', 20);
            table.string('phone', 20);
            table.string('avatar_url', 500);
            table.boolean('is_active').defaultTo(true);
            table.timestamp('last_login');
            table.timestamps(true, true);

            table.index('email');
            table.index('role');
            table.index('is_active');
        })

        // Floors table
        .createTable('floors', (table) => {
            table.increments('id').primary();
            table.string('name', 100).notNullable();
            table.string('building', 100).defaultTo('Main');
            table.uuid('assigned_staff_id').references('id').inTable('users').onDelete('SET NULL');
            table.timestamps(true, true);

            table.index('assigned_staff_id');
        })

        // Rooms table
        .createTable('rooms', (table) => {
            table.increments('id').primary();
            table.string('room_number', 20).unique().notNullable();
            table.integer('floor_id').unsigned().notNullable().references('id').inTable('floors').onDelete('CASCADE');
            table.enum('status', ['pending', 'in-progress', 'cleaned', 'needs-maintenance']).defaultTo('pending');
            table.uuid('resident_id').references('id').inTable('users').onDelete('SET NULL');
            table.timestamp('last_cleaned');
            table.uuid('assigned_staff_id').references('id').inTable('users').onDelete('SET NULL');
            table.text('notes');
            table.timestamps(true, true);

            table.index('floor_id');
            table.index('status');
            table.index('resident_id');
            table.index('assigned_staff_id');
        })

        // Complaints table
        .createTable('complaints', (table) => {
            table.increments('id').primary();
            table.string('category', 100).notNullable();
            table.string('room_number', 20).notNullable();
            table.text('description').notNullable();
            table.enum('status', ['pending', 'in-progress', 'resolved']).defaultTo('pending');
            table.enum('priority', ['low', 'medium', 'high', 'urgent']).defaultTo('medium');
            table.uuid('resident_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
            table.uuid('assigned_staff_id').references('id').inTable('users').onDelete('SET NULL');
            table.string('image_url', 500);
            table.jsonb('ai_analysis');
            table.string('ai_suggested_priority', 20);
            table.string('ai_suggested_category', 100);
            table.text('resolution_notes');
            table.timestamp('resolved_at');
            table.timestamps(true, true);

            table.index('status');
            table.index('priority');
            table.index('category');
            table.index('resident_id');
            table.index('assigned_staff_id');
            table.index('room_number');
            table.index('created_at');
        })

        // Cleaning logs table
        .createTable('cleaning_logs', (table) => {
            table.increments('id').primary();
            table.integer('room_id').unsigned().notNullable().references('id').inTable('rooms').onDelete('CASCADE');
            table.uuid('staff_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
            table.string('status', 50).notNullable();
            table.text('notes');
            table.integer('duration_minutes');
            table.timestamps(true, true);

            table.index('room_id');
            table.index('staff_id');
            table.index('created_at');
        })

        // Notifications table
        .createTable('notifications', (table) => {
            table.increments('id').primary();
            table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
            table.string('title', 255).notNullable();
            table.text('message').notNullable();
            table.enum('type', ['info', 'warning', 'success', 'error']).defaultTo('info');
            table.boolean('read').defaultTo(false);
            table.timestamps(true, true);

            table.index('user_id');
            table.index('read');
            table.index('created_at');
        })

        // AI Insights table
        .createTable('ai_insights', (table) => {
            table.increments('id').primary();
            table.string('type', 100).notNullable();
            table.jsonb('data').notNullable();
            table.float('confidence');
            table.uuid('generated_by');
            table.timestamps(true, true);

            table.index('type');
            table.index('created_at');
        })

        // Refresh tokens table (for auth)
        .createTable('refresh_tokens', (table) => {
            table.increments('id').primary();
            table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
            table.string('token', 500).unique().notNullable();
            table.timestamp('expires_at').notNullable();
            table.boolean('revoked').defaultTo(false);
            table.timestamps(true, true);

            table.index('user_id');
            table.index('token');
            table.index('expires_at');
        })

        // Audit log table
        .createTable('audit_logs', (table) => {
            table.increments('id').primary();
            table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
            table.string('action', 100).notNullable();
            table.string('entity_type', 100).notNullable();
            table.string('entity_id', 100);
            table.jsonb('details');
            table.string('ip_address', 45);
            table.timestamp('created_at').defaultTo(knex.fn.now());

            table.index('user_id');
            table.index('action');
            table.index('entity_type');
            table.index('created_at');
        });
};

exports.down = function (knex) {
    return knex.schema
        .dropTableIfExists('audit_logs')
        .dropTableIfExists('refresh_tokens')
        .dropTableIfExists('ai_insights')
        .dropTableIfExists('notifications')
        .dropTableIfExists('cleaning_logs')
        .dropTableIfExists('complaints')
        .dropTableIfExists('rooms')
        .dropTableIfExists('floors')
        .dropTableIfExists('users');
};
