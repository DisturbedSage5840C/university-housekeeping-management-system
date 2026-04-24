/**
 * Migration: H2 Hostel floor-wise facility cleaning tracker
 */

const H2_FACILITY_CONFIG = {
    G: [
        { type: 'Meeting Room', count: 4 },
        { type: 'Lounge', count: 1 },
        { type: 'MPH', count: 1 },
        { type: 'Art Room', count: 1 },
        { type: 'Washroom (Male)', count: 2 },
        { type: 'Washroom (Female)', count: 2 },
        { type: 'Washroom (Inclusive)', count: 1 },
    ],
    1: [
        { type: 'Room', count: 17 },
        { type: 'Meeting Room', count: 8 },
        { type: 'Washroom', count: 1 },
        { type: 'Refrigerator', count: 1 },
        { type: 'Induction', count: 1 },
        { type: 'Water Cooler', count: 2 },
        { type: 'Microwave', count: 1 },
        { type: 'Sink', count: 1 },
        { type: 'Corridor', count: 1 },
        { type: 'Balcony', count: 1 },
    ],
    2: [
        { type: 'Room', count: 32 },
        { type: 'Washroom', count: 2 },
        { type: 'Refrigerator', count: 1 },
        { type: 'Induction', count: 1 },
        { type: 'Water Cooler', count: 2 },
        { type: 'Microwave', count: 1 },
        { type: 'Sink', count: 1 },
        { type: 'Corridor', count: 1 },
        { type: 'Drying Stand', count: 2 },
    ],
    3: [
        { type: 'Room', count: 32 },
        { type: 'Washroom', count: 2 },
        { type: 'Refrigerator', count: 1 },
        { type: 'Induction', count: 1 },
        { type: 'Water Cooler', count: 2 },
        { type: 'Microwave', count: 1 },
        { type: 'Sink', count: 1 },
        { type: 'Corridor', count: 1 },
        { type: 'Washing Machine', count: 2 },
        { type: 'Drying Stand', count: 2 },
    ],
    4: [
        { type: 'Room', count: 32 },
        { type: 'Washroom', count: 2 },
        { type: 'Refrigerator', count: 1 },
        { type: 'Induction', count: 1 },
        { type: 'Water Cooler', count: 2 },
        { type: 'Microwave', count: 1 },
        { type: 'Sink', count: 1 },
        { type: 'Corridor', count: 1 },
        { type: 'Drying Stand', count: 2 },
    ],
    5: [
        { type: 'Room', count: 32 },
        { type: 'Washroom', count: 2 },
        { type: 'Refrigerator', count: 1 },
        { type: 'Induction', count: 1 },
        { type: 'Water Cooler', count: 2 },
        { type: 'Microwave', count: 1 },
        { type: 'Sink', count: 1 },
        { type: 'Corridor', count: 1 },
        { type: 'Washing Machine', count: 2 },
        { type: 'Drying Stand', count: 2 },
    ],
    6: [
        { type: 'Room', count: 32 },
        { type: 'Washroom', count: 2 },
        { type: 'Refrigerator', count: 1 },
        { type: 'Induction', count: 1 },
        { type: 'Water Cooler', count: 2 },
        { type: 'Microwave', count: 1 },
        { type: 'Sink', count: 1 },
        { type: 'Corridor', count: 1 },
        { type: 'Drying Stand', count: 2 },
    ],
    7: [
        { type: 'Room', count: 27 },
        { type: 'Washroom', count: 2 },
        { type: 'Refrigerator', count: 1 },
        { type: 'Induction', count: 1 },
        { type: 'Water Cooler', count: 2 },
        { type: 'Microwave', count: 1 },
        { type: 'Sink', count: 1 },
        { type: 'Corridor', count: 1 },
        { type: 'Washing Machine', count: 2 },
        { type: 'Drying Stand', count: 2 },
    ],
    8: [
        { type: 'Room', count: 32 },
        { type: 'Washroom', count: 2 },
        { type: 'Refrigerator', count: 1 },
        { type: 'Induction', count: 1 },
        { type: 'Water Cooler', count: 2 },
        { type: 'Microwave', count: 1 },
        { type: 'Sink', count: 1 },
        { type: 'Corridor', count: 1 },
        { type: 'Drying Stand', count: 2 },
    ],
    9: [
        { type: 'Room', count: 32 },
        { type: 'Washroom', count: 2 },
        { type: 'Refrigerator', count: 1 },
        { type: 'Induction', count: 1 },
        { type: 'Water Cooler', count: 2 },
        { type: 'Microwave', count: 1 },
        { type: 'Sink', count: 1 },
        { type: 'Corridor', count: 1 },
        { type: 'Drying Stand', count: 2 },
    ],
};

exports.up = async function up(knex) {
    await knex.schema.createTable('facility_updates', (table) => {
        table.increments('id').primary();
        table.string('building', 100).notNullable();
        table.string('floor', 10).notNullable();
        table.string('facility_type', 100).notNullable();
        table.integer('facility_number').notNullable();
        table.string('cleaned', 5);
        table.string('photo_url', 500);
        table.timestamp('last_updated');
        table.string('updated_by', 255);
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

        table.index('building');
        table.index('floor');
        table.index('facility_type');
        table.index('last_updated');
        table.unique(['building', 'floor', 'facility_type', 'facility_number'], 'facility_updates_unique_row');
    });

    const rows = [];
    Object.entries(H2_FACILITY_CONFIG).forEach(([floor, facilities]) => {
        facilities.forEach((facility) => {
            for (let number = 1; number <= facility.count; number += 1) {
                rows.push({
                    building: 'H2 Hostel',
                    floor,
                    facility_type: facility.type,
                    facility_number: number,
                });
            }
        });
    });

    if (rows.length) {
        await knex('facility_updates').insert(rows);
    }
};

exports.down = async function down(knex) {
    await knex.schema.dropTableIfExists('facility_updates');
};
