/**
 * Migration: password_reset_otps
 * Stores hashed OTPs for secure forgot-password flow.
 */

exports.up = function (knex) {
    return knex.schema.createTable('password_reset_otps', (table) => {
        table.increments('id').primary();
        table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.string('phone', 20).notNullable();
        table.string('otp_hash', 255).notNullable();
        table.timestamp('expires_at').notNullable();
        table.boolean('used').defaultTo(false);
        table.integer('attempts').defaultTo(0);
        table.timestamps(true, true);

        table.index('user_id');
        table.index('expires_at');
        table.index('used');
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('password_reset_otps');
};
