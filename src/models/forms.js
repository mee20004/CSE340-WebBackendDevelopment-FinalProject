import { query } from './db.js';

export async function listActiveForms() {
    const res = await query('SELECT * FROM forms WHERE is_active = TRUE ORDER BY title');
    return res.rows;
}

export async function listAppointmentTypes() {
    const res = await query(
        `SELECT DISTINCT appointment_type FROM forms
         WHERE is_active = TRUE AND appointment_type IS NOT NULL AND appointment_type != ''
         ORDER BY appointment_type`
    );  
    return res.rows.map((r) => r.appointment_type);
}

export async function listAllForms() {
    const res = await query('SELECT * FROM forms ORDER BY created_at DESC');
    return res.rows;
}

export async function getFormWithBlocks(formId) {
    const formRes = await query('SELECT * FROM forms WHERE id = $1', [formId]);
    const form = formRes.rows[0];
    if (!form) return null;

    const blocksRes = await query(
        'SELECT * FROM form_blocks WHERE form_id = $1 ORDER BY sort_order, id',
        [formId]
    );
    form.blocks = blocksRes.rows;
    return form;
}

async function insertBlocks(formId, blocks) {
    let sortOrder = 1;
    for (const block of blocks) {
        await query(
            `INSERT INTO form_blocks (form_id, label, block_type, options, is_required, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                formId,
                block.label,
                block.blockType,
                block.options ? JSON.stringify(block.options) : null,
                Boolean(block.isRequired),
                sortOrder++,
            ]
        );
    }
}

export async function createForm({ title, description, appointmentType, createdByUserId }, blocks) {
    const formRes = await query(
        `INSERT INTO forms (title, description, appointment_type, created_by_user_id) VALUES ($1, $2, $3, $4) RETURNING id`,
        [title, description || null, appointmentType || null, createdByUserId]
    );
    const formId = formRes.rows[0].id;
    await insertBlocks(formId, blocks);
    return formId;
}

export async function updateForm(formId, { title, description, appointmentType, isActive }, blocks) {
    await query(
        `UPDATE forms SET title = $1, description = $2, appointment_type = $3, is_active = $4, updated_at = NOW() WHERE id = $5`,
        [title, description || null, appointmentType || null, isActive, formId]
    );
    await query('DELETE FROM form_blocks WHERE form_id = $1', [formId]);
    await insertBlocks(formId, blocks);
}

export async function deleteForm(formId) {
    await query('DELETE FROM forms WHERE id = $1', [formId]);
}
