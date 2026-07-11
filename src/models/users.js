import { query } from './db.js';

export async function findUserByEmail(email) {
    const res = await query('SELECT * FROM users WHERE email = $1', [email]);
    return res.rows[0] || null;
}

export async function findUserById(id) {
    const res = await query('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows[0] || null;
}

export async function createUser({ email, passwordHash, role, firstName, lastName, phone }) {
    const res = await query(
        `INSERT INTO users (email, password_hash, role, first_name, last_name, phone)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, role, first_name, last_name, phone, created_at`,
        [email, passwordHash, role, firstName, lastName, phone || null]
    );
    return res.rows[0];
}

export async function listStaff() {
    const res = await query(
        `SELECT id, email, first_name, last_name, phone, created_at
         FROM users WHERE role = 'staff' ORDER BY created_at DESC`
    );
    return res.rows;
}

export async function listPatients() {
    const res = await query(
        `SELECT id, email, first_name, last_name
         FROM users WHERE role = 'patient' ORDER BY last_name, first_name`
    );
    return res.rows;
}

export async function deleteStaffById(id) {
    await query(`DELETE FROM users WHERE id = $1 AND role = 'staff'`, [id]);
}
