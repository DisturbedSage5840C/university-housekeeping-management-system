/**
 * Database Seed: Initial users and data for ILGC Tracker
 * Campus Hygiene Monitoring System
 */
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
    // Clear existing data in proper order
    await knex('audit_logs').del();
    await knex('refresh_tokens').del();
    try { await knex('password_reset_otps').del(); } catch(e) {}
    await knex('ai_insights').del();
    await knex('notifications').del();
    await knex('cleaning_logs').del();
    await knex('complaints').del();
    await knex('rooms').del();
    await knex('floors').del();
    // Clear new tables (ignore if they don't exist yet)
    try { await knex('reminders').del(); } catch(e) {}
    try { await knex('supply_inventory').del(); } catch(e) {}
    try { await knex('work_submissions').del(); } catch(e) {}
    try { await knex('washrooms').del(); } catch(e) {}
    await knex('users').del();

    // Hash passwords
    const password = await bcrypt.hash('password123', 12);

    // Users
    const adminId = uuidv4();
    const sup1Id = uuidv4(); // Supervisor
    const sup2Id = uuidv4(); // Supervisor
    const staff1Id = uuidv4(); // Cleaning staff
    const staff2Id = uuidv4();
    const staff3Id = uuidv4();
    const staff4Id = uuidv4();
    const resident1Id = uuidv4();
    const resident2Id = uuidv4();
    const resident3Id = uuidv4();
    const resident4Id = uuidv4();

    await knex('users').insert([
        { id: adminId, email: 'admin@hostel.com', password, name: 'Admin Manager', role: 'admin', phone: '+91-9876543210' },
        { id: sup1Id, email: 'meera@hostel.com', password, name: 'Meera Desai', role: 'supervisor', phone: '+91-9876543220', shift: 'morning' },
        { id: sup2Id, email: 'suresh@hostel.com', password, name: 'Suresh Nair', role: 'supervisor', phone: '+91-9876543221', shift: 'evening' },
        { id: staff1Id, email: 'rajesh@hostel.com', password, name: 'Rajesh Kumar', role: 'staff', phone: '+91-9876543211', shift: 'morning', supervisor_id: sup1Id },
        { id: staff2Id, email: 'priya@hostel.com', password, name: 'Priya Sharma', role: 'staff', phone: '+91-9876543212', shift: 'evening', supervisor_id: sup2Id },
        { id: staff3Id, email: 'amit@hostel.com', password, name: 'Amit Patel', role: 'staff', phone: '+91-9876543213', shift: 'morning', supervisor_id: sup1Id },
        { id: staff4Id, email: 'sunita@hostel.com', password, name: 'Sunita Verma', role: 'staff', phone: '+91-9876543218', shift: 'evening', supervisor_id: sup2Id },
        { id: resident1Id, email: 'student1@hostel.com', password, name: 'Arjun Singh', role: 'resident', room_number: 'H1-101', phone: '+91-9876543214' },
        { id: resident2Id, email: 'student2@hostel.com', password, name: 'Neha Gupta', role: 'resident', room_number: 'H2-205', phone: '+91-9876543215' },
        { id: resident3Id, email: 'student3@hostel.com', password, name: 'Vikram Reddy', role: 'resident', room_number: 'H3-302', phone: '+91-9876543216' },
        { id: resident4Id, email: 'faculty1@hostel.com', password, name: 'Dr. Sneha Iyer', role: 'resident', room_number: 'Academic Block', phone: '+91-9876543217' },
    ]);

    // Floors (keep for backward compat with rooms)
    const [floor1] = await knex('floors').insert({ name: 'Ground Floor', building: 'H1', assigned_staff_id: staff1Id }).returning('id');
    const [floor2] = await knex('floors').insert({ name: 'First Floor', building: 'H1', assigned_staff_id: staff2Id }).returning('id');
    const [floor3] = await knex('floors').insert({ name: 'Second Floor', building: 'H2', assigned_staff_id: staff3Id }).returning('id');
    const [floor4] = await knex('floors').insert({ name: 'Third Floor', building: 'H3', assigned_staff_id: staff1Id }).returning('id');

    // Rooms (kept for backward compat)
    const roomInserts = [];
    const statuses = ['pending', 'cleaned', 'in-progress', 'needs-maintenance'];
    const floors = [floor1.id, floor2.id, floor3.id, floor4.id];
    const staffIds = [staff1Id, staff2Id, staff3Id];

    for (let f = 0; f < 4; f++) {
        for (let r = 1; r <= 12; r++) {
            const roomNum = `${f + 1}${r.toString().padStart(2, '0')}`;
            roomInserts.push({
                room_number: roomNum,
                floor_id: floors[f],
                status: statuses[Math.floor(Math.random() * statuses.length)],
                assigned_staff_id: staffIds[f % 3],
            });
        }
    }
    await knex('rooms').insert(roomInserts);

    // Washrooms (building/floor/direction based)
    const hasWashrooms = await knex.schema.hasTable('washrooms');
    if (hasWashrooms) {
        const now = new Date();
        const washrooms = [
            // H1 - 4 floors
            { building: 'H1', floor: 0, direction: 'East', label: 'H1 Ground Floor East', soap_level: 80, tissue_level: 60, sanitizer_level: 70, freshener_level: 90, status: 'clean', last_restocked: new Date(now - 3600000 * 6), assigned_staff_id: staff1Id },
            { building: 'H1', floor: 1, direction: 'East', label: 'H1 Floor 1 East', soap_level: 45, tissue_level: 30, sanitizer_level: 55, freshener_level: 40, status: 'needs-cleaning', last_restocked: new Date(now - 3600000 * 18), assigned_staff_id: staff1Id },
            { building: 'H1', floor: 2, direction: 'East', label: 'H1 Floor 2 East', soap_level: 90, tissue_level: 85, sanitizer_level: 95, freshener_level: 80, status: 'clean', last_restocked: new Date(now - 3600000 * 2), assigned_staff_id: staff2Id },
            { building: 'H1', floor: 3, direction: 'East', label: 'H1 Floor 3 East', soap_level: 60, tissue_level: 50, sanitizer_level: 40, freshener_level: 55, status: 'clean', last_restocked: new Date(now - 3600000 * 12), assigned_staff_id: staff2Id },
            // H2 - North/South Wings
            { building: 'H2', floor: 0, direction: 'North Wing', label: 'H2 Ground Floor North Wing', soap_level: 70, tissue_level: 65, sanitizer_level: 75, freshener_level: 60, status: 'clean', last_restocked: new Date(now - 3600000 * 8), assigned_staff_id: staff3Id },
            { building: 'H2', floor: 0, direction: 'South Wing', label: 'H2 Ground Floor South Wing', soap_level: 20, tissue_level: 15, sanitizer_level: 10, freshener_level: 30, status: 'needs-cleaning', last_restocked: new Date(now - 3600000 * 30), assigned_staff_id: staff3Id },
            { building: 'H2', floor: 1, direction: 'North Wing', label: 'H2 Floor 1 North Wing', soap_level: 85, tissue_level: 80, sanitizer_level: 90, freshener_level: 85, status: 'clean', last_restocked: new Date(now - 3600000 * 4), assigned_staff_id: staff3Id },
            { building: 'H2', floor: 1, direction: 'South Wing', label: 'H2 Floor 1 South Wing', soap_level: 55, tissue_level: 40, sanitizer_level: 50, freshener_level: 45, status: 'in-progress', last_restocked: new Date(now - 3600000 * 14), assigned_staff_id: staff4Id },
            { building: 'H2', floor: 2, direction: 'North Wing', label: 'H2 Floor 2 North Wing', soap_level: 35, tissue_level: 25, sanitizer_level: 30, freshener_level: 20, status: 'needs-cleaning', last_restocked: new Date(now - 3600000 * 24), assigned_staff_id: staff4Id },
            { building: 'H2', floor: 2, direction: 'South Wing', label: 'H2 Floor 2 South Wing', soap_level: 95, tissue_level: 90, sanitizer_level: 88, freshener_level: 92, status: 'clean', last_restocked: new Date(now - 3600000 * 1), assigned_staff_id: staff4Id },
            // H3
            { building: 'H3', floor: 0, direction: null, label: 'H3 Ground Floor', soap_level: 75, tissue_level: 70, sanitizer_level: 80, freshener_level: 65, status: 'clean', last_restocked: new Date(now - 3600000 * 7), assigned_staff_id: staff1Id },
            { building: 'H3', floor: 1, direction: null, label: 'H3 Floor 1', soap_level: 50, tissue_level: 45, sanitizer_level: 55, freshener_level: 50, status: 'in-progress', last_restocked: new Date(now - 3600000 * 16), assigned_staff_id: staff2Id },
            { building: 'H3', floor: 2, direction: null, label: 'H3 Floor 2', soap_level: 40, tissue_level: 35, sanitizer_level: 30, freshener_level: 25, status: 'needs-cleaning', last_restocked: new Date(now - 3600000 * 22), assigned_staff_id: staff3Id },
            // Academic Block
            { building: 'Academic Block', floor: 0, direction: null, label: 'Academic Block Ground Floor', soap_level: 60, tissue_level: 55, sanitizer_level: 65, freshener_level: 50, status: 'clean', last_restocked: new Date(now - 3600000 * 10), assigned_staff_id: staff1Id },
            { building: 'Academic Block', floor: 1, direction: null, label: 'Academic Block Floor 1', soap_level: 30, tissue_level: 20, sanitizer_level: 25, freshener_level: 35, status: 'needs-cleaning', last_restocked: new Date(now - 3600000 * 20), assigned_staff_id: staff2Id },
            { building: 'Academic Block', floor: 2, direction: null, label: 'Academic Block Floor 2', soap_level: 88, tissue_level: 82, sanitizer_level: 90, freshener_level: 85, status: 'clean', last_restocked: new Date(now - 3600000 * 3), assigned_staff_id: staff3Id },
            // Library
            { building: 'Library', floor: 0, direction: null, label: 'Library Ground Floor', soap_level: 70, tissue_level: 75, sanitizer_level: 80, freshener_level: 70, status: 'clean', last_restocked: new Date(now - 3600000 * 5), assigned_staff_id: staff4Id },
            { building: 'Library', floor: 1, direction: null, label: 'Library Floor 1', soap_level: 55, tissue_level: 50, sanitizer_level: 60, freshener_level: 45, status: 'clean', last_restocked: new Date(now - 3600000 * 11), assigned_staff_id: staff4Id },
            // Cafeteria
            { building: 'Cafeteria', floor: 0, direction: 'Main', label: 'Cafeteria Main', soap_level: 25, tissue_level: 20, sanitizer_level: 15, freshener_level: 30, status: 'needs-cleaning', last_restocked: new Date(now - 3600000 * 26), assigned_staff_id: staff1Id },
            { building: 'Cafeteria', floor: 0, direction: 'Staff Section', label: 'Cafeteria Staff Section', soap_level: 85, tissue_level: 80, sanitizer_level: 90, freshener_level: 85, status: 'clean', last_restocked: new Date(now - 3600000 * 4), assigned_staff_id: staff2Id },
        ];
        await knex('washrooms').insert(washrooms);

        // Work submissions (sample proofs)
        await knex('work_submissions').insert([
            { staff_id: staff1Id, washroom_id: 1, building: 'H1', floor: 0, task_type: 'restocking', notes: 'Refilled soap and tissue dispensers', image_url: null, llm_verified: true, llm_score: 0.92, llm_feedback: 'Image shows restocked dispensers', supervisor_approved: true, approved_by: sup1Id, approved_at: new Date(now - 3600000 * 5) },
            { staff_id: staff3Id, washroom_id: 6, building: 'H2', floor: 0, task_type: 'cleaning', notes: 'Deep cleaned south wing washroom', image_url: null, llm_verified: true, llm_score: 0.87, llm_feedback: 'Clean washroom visible', supervisor_approved: true, approved_by: sup1Id, approved_at: new Date(now - 3600000 * 3) },
            { staff_id: staff2Id, washroom_id: 12, building: 'H3', floor: 1, task_type: 'restocking', notes: 'Restocked sanitizer and freshener', image_url: null, llm_verified: true, llm_score: 0.78, llm_feedback: 'Partially visible restocking', supervisor_approved: null },
            { staff_id: staff4Id, washroom_id: 9, building: 'H2', floor: 2, task_type: 'cleaning', notes: 'Mopped and sanitized', image_url: null, llm_verified: false, llm_score: 0.45, llm_feedback: 'Image unclear, cannot verify cleaning', supervisor_approved: null },
        ]);

        // Supply inventory
        await knex('supply_inventory').insert([
            { building: 'H1', item_name: 'Liquid Soap (5L)', current_stock: 12, min_threshold: 5, unit: 'cans', last_refilled: new Date(now - 86400000 * 2), last_refilled_by: staff1Id },
            { building: 'H1', item_name: 'Tissue Rolls', current_stock: 48, min_threshold: 20, unit: 'rolls', last_refilled: new Date(now - 86400000 * 1), last_refilled_by: staff1Id },
            { building: 'H1', item_name: 'Hand Sanitizer (1L)', current_stock: 8, min_threshold: 4, unit: 'bottles', last_refilled: new Date(now - 86400000 * 3), last_refilled_by: staff2Id },
            { building: 'H2', item_name: 'Liquid Soap (5L)', current_stock: 6, min_threshold: 5, unit: 'cans', last_refilled: new Date(now - 86400000 * 4), last_refilled_by: staff3Id },
            { building: 'H2', item_name: 'Tissue Rolls', current_stock: 15, min_threshold: 20, unit: 'rolls', last_refilled: new Date(now - 86400000 * 5), last_refilled_by: staff3Id },
            { building: 'H2', item_name: 'Hand Sanitizer (1L)', current_stock: 3, min_threshold: 4, unit: 'bottles', last_refilled: new Date(now - 86400000 * 6), last_refilled_by: staff4Id },
            { building: 'H2', item_name: 'Air Freshener', current_stock: 10, min_threshold: 4, unit: 'cans', last_refilled: new Date(now - 86400000 * 2), last_refilled_by: staff4Id },
            { building: 'H3', item_name: 'Liquid Soap (5L)', current_stock: 4, min_threshold: 5, unit: 'cans', last_refilled: new Date(now - 86400000 * 7), last_refilled_by: staff1Id },
            { building: 'H3', item_name: 'Tissue Rolls', current_stock: 30, min_threshold: 20, unit: 'rolls', last_refilled: new Date(now - 86400000 * 3), last_refilled_by: staff2Id },
            { building: 'Academic Block', item_name: 'Liquid Soap (5L)', current_stock: 8, min_threshold: 5, unit: 'cans', last_refilled: new Date(now - 86400000 * 2), last_refilled_by: staff1Id },
            { building: 'Academic Block', item_name: 'Tissue Rolls', current_stock: 25, min_threshold: 15, unit: 'rolls', last_refilled: new Date(now - 86400000 * 1), last_refilled_by: staff2Id },
            { building: 'Academic Block', item_name: 'Hand Sanitizer (1L)', current_stock: 6, min_threshold: 4, unit: 'bottles', last_refilled: new Date(now - 86400000 * 4), last_refilled_by: staff3Id },
            { building: 'Library', item_name: 'Liquid Soap (5L)', current_stock: 5, min_threshold: 3, unit: 'cans', last_refilled: new Date(now - 86400000 * 3), last_refilled_by: staff4Id },
            { building: 'Library', item_name: 'Tissue Rolls', current_stock: 18, min_threshold: 10, unit: 'rolls', last_refilled: new Date(now - 86400000 * 2), last_refilled_by: staff4Id },
            { building: 'Cafeteria', item_name: 'Liquid Soap (5L)', current_stock: 2, min_threshold: 5, unit: 'cans', last_refilled: new Date(now - 86400000 * 8), last_refilled_by: staff1Id },
            { building: 'Cafeteria', item_name: 'Tissue Rolls', current_stock: 8, min_threshold: 15, unit: 'rolls', last_refilled: new Date(now - 86400000 * 6), last_refilled_by: staff2Id },
            { building: 'Cafeteria', item_name: 'Hand Sanitizer (1L)', current_stock: 1, min_threshold: 3, unit: 'bottles', last_refilled: new Date(now - 86400000 * 10), last_refilled_by: staff3Id },
        ]);

        // Reminders
        await knex('reminders').insert([
            { building: 'H1', reminder_type: 'restocking', frequency: '8h', notify_portal: true, notify_mobile: true, notes: 'Regular restocking cycle', created_by: sup1Id, next_due: new Date(now + 3600000 * 4), is_active: true },
            { building: 'H2', reminder_type: 'cleaning', frequency: '4h', notify_portal: true, notify_mobile: true, notes: 'High traffic area - North Wing', created_by: sup1Id, next_due: new Date(now + 3600000 * 2), is_active: true },
            { building: 'Cafeteria', reminder_type: 'restocking', frequency: '4h', notify_portal: true, notify_mobile: false, notes: 'Peak hours 12-2pm', created_by: sup2Id, next_due: new Date(now + 3600000 * 1), is_active: true },
            { building: 'Academic Block', reminder_type: 'inspection', frequency: '12h', notify_portal: true, notify_mobile: false, notes: 'Daily inspection schedule', created_by: sup2Id, next_due: new Date(now + 3600000 * 8), is_active: true },
        ]);
    }

    // Sample complaints (hygiene themed)
    const now2 = new Date();
    await knex('complaints').insert([
        {
            category: 'hygiene', room_number: 'H1 - Floor 2 East', building: 'H1',
            description: 'No soap in washroom for 3 days. Tissue dispensers also empty.',
            status: 'pending', priority: 'high', resident_id: resident1Id,
        },
        {
            category: 'cleaning', room_number: 'H2 - Ground Floor South Wing', building: 'H2',
            description: 'Washroom not cleaned for 2 days. Floor is dirty and smells bad.',
            status: 'in-progress', priority: 'high', resident_id: resident2Id, assigned_staff_id: staff3Id,
        },
        {
            category: 'hygiene', room_number: 'Academic Block - Floor 1', building: 'Academic Block',
            description: 'Sanitizer dispenser broken. No hand soap available.',
            status: 'resolved', priority: 'medium', resident_id: resident4Id, assigned_staff_id: staff2Id,
            resolved_at: new Date(now2 - 86400000),
        },
        {
            category: 'false_reporting', room_number: 'H2 - Floor 2 North Wing', building: 'H2',
            description: 'Staff uploaded old photo as proof of restocking but washroom still has no tissues. Photo metadata shows it was taken 3 days ago.',
            status: 'pending', priority: 'urgent', resident_id: resident1Id,
        },
        {
            category: 'plumbing', room_number: 'H3 - Floor 2', building: 'H3',
            description: 'Soap dispenser is leaking, wasting liquid soap. Needs repair.',
            status: 'in-progress', priority: 'medium', resident_id: resident3Id, assigned_staff_id: staff1Id,
        },
        {
            category: 'hygiene', room_number: 'Cafeteria - Main', building: 'Cafeteria',
            description: 'No tissue paper or hand soap in cafeteria washroom during lunch hours.',
            status: 'pending', priority: 'high', resident_id: resident2Id,
        },
        {
            category: 'cleaning', room_number: 'Library - Ground Floor', building: 'Library',
            description: 'Floor is wet and slippery near washroom entrance, safety hazard.',
            status: 'pending', priority: 'urgent', resident_id: resident3Id,
        },
    ]);

    // Sample notifications
    await knex('notifications').insert([
        { user_id: resident1Id, title: 'Complaint Received', message: 'Your hygiene complaint for H1 Floor 2 East has been logged.', type: 'info' },
        { user_id: staff1Id, title: 'New Task Assigned', message: 'Soap dispenser repair in H3 Floor 2 assigned to you.', type: 'warning' },
        { user_id: sup1Id, title: 'Pending Verification', message: '2 work submissions awaiting your approval.', type: 'warning' },
        { user_id: adminId, title: 'Low Stock Alert', message: 'Cafeteria soap and sanitizer below minimum threshold.', type: 'error' },
        { user_id: sup2Id, title: 'Reminder Due', message: 'Cafeteria restocking check is overdue.', type: 'warning' },
    ]);
};
