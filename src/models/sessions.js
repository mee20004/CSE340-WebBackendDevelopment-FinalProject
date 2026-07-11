import { query } from './db.js';

export async function createSession({ patientUserId, formId, createdByUserId }) {
    const res = await query(
        `INSERT INTO checkin_sessions (patient_user_id, form_id, created_by_user_id)
         VALUES ($1, $2, $3) RETURNING id`,
        [patientUserId, formId, createdByUserId]
    );
    return res.rows[0].id;
}

export async function listSessionsForPractice() {
    const res = await query(`
        SELECT cs.*, f.title AS form_title,
               u.first_name AS patient_first_name, u.last_name AS patient_last_name
        FROM checkin_sessions cs
        JOIN forms f ON f.id = cs.form_id
        JOIN users u ON u.id = cs.patient_user_id
        ORDER BY cs.created_at DESC 
        LIMIT 100
    `);
    return res.rows;
}

export async function listSessionsForPatient(patientUserId) {
    const res = await query(`
        SELECT cs.*, f.title AS form_title
        FROM checkin_sessions cs
        JOIN forms f ON f.id = cs.form_id
        WHERE cs.patient_user_id = $1
        ORDER BY cs.created_at DESC
    `, [patientUserId]);
    return res.rows;
}

export async function getSessionById(sessionId) {
    const res = await query(`
        SELECT cs.*, f.title AS form_title,
               u.first_name AS patient_first_name, u.last_name AS patient_last_name, u.email AS patient_email
        FROM checkin_sessions cs
        JOIN forms f ON f.id = cs.form_id
        JOIN users u ON u.id = cs.patient_user_id
        WHERE cs.id = $1
    `, [sessionId]);
    return res.rows[0] || null;
}

export async function getAnswersForSession(sessionId) {
    const res = await query(`
        SELECT sa.form_block_id, sa.value
        FROM submission_answers sa
        JOIN submissions s ON s.id = sa.submission_id
        WHERE s.checkin_session_id = $1
    `, [sessionId]);
    const map = {};
    for (const row of res.rows) {
        map[row.form_block_id] = row.value;
    }
    return map;
}

async function upsertSubmission(sessionId) {
    const existing = await query(
        'SELECT id FROM submissions WHERE checkin_session_id = $1',
        [sessionId]
    );
    if (existing.rows.length) {
        await query('UPDATE submissions SET submitted_at = NOW() WHERE id = $1', [existing.rows[0].id]);
        return existing.rows[0].id;
    }
    const inserted = await query(
        'INSERT INTO submissions (checkin_session_id) VALUES ($1) RETURNING id',
        [sessionId]
    );
    return inserted.rows[0].id;
}

async function replaceAnswers(submissionId, answers) {
    await query('DELETE FROM submission_answers WHERE submission_id = $1', [submissionId]);
    for (const [formBlockId, value] of Object.entries(answers)) {
        if (value === undefined || value === null) continue;
        await query(
            'INSERT INTO submission_answers (submission_id, form_block_id, value) VALUES ($1, $2, $3)',
            [submissionId, formBlockId, value]
        );
    }
}

// answers
export async function saveProgress(sessionId, answers) {
    await query(
        `UPDATE checkin_sessions SET status = 'in_progress' WHERE id = $1 AND status = 'created'`,
        [sessionId]
    );
    const submissionId = await upsertSubmission(sessionId);
    await replaceAnswers(submissionId, answers);
}

export async function submitSession(sessionId, answers) {
    const submissionId = await upsertSubmission(sessionId);
    await replaceAnswers(submissionId, answers);
    await query(
        `UPDATE checkin_sessions SET status = 'submitted', submitted_at = NOW() WHERE id = $1`,
        [sessionId]
    );
}

export async function closeSession(sessionId) {
    await query(
        `UPDATE checkin_sessions SET status = 'closed', closed_at = NOW() WHERE id = $1 AND status = 'submitted'`,
        [sessionId]
    );
}

export async function cancelSession(sessionId, patientUserId) {
    const res = await query(
        `DELETE FROM checkin_sessions
         WHERE id = $1 AND patient_user_id = $2 AND status IN ('created', 'in_progress')`,
        [sessionId, patientUserId]
    );
    return res.rowCount > 0;
}
