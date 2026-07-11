import bcrypt from 'bcrypt';
import { query } from './db.js';

const TEST_PASSWORD = 'P@$$w0rd!';

const CREATE_TABLES_SQL = `
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'staff', 'patient')),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(30),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS forms (
        id SERIAL PRIMARY KEY,
        title VARCHAR(150) NOT NULL,
        description TEXT,
        appointment_type VARCHAR(100),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS form_blocks (
        id SERIAL PRIMARY KEY,
        form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        label VARCHAR(200) NOT NULL,
        block_type VARCHAR(20) NOT NULL CHECK (block_type IN ('text', 'textarea', 'select', 'checkbox', 'date')),
        options JSONB,
        is_required BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS checkin_sessions (
        id SERIAL PRIMARY KEY,
        patient_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE RESTRICT,
        created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        status VARCHAR(20) NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'in_progress', 'submitted', 'closed', 'expired')),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        submitted_at TIMESTAMP,
        closed_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        checkin_session_id INTEGER UNIQUE NOT NULL REFERENCES checkin_sessions(id) ON DELETE CASCADE,
        submitted_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS submission_answers (
        id SERIAL PRIMARY KEY,
        submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
        form_block_id INTEGER NOT NULL REFERENCES form_blocks(id) ON DELETE CASCADE,
        value TEXT
    );
`;

const MIGRATE_SQL = `
    ALTER TABLE forms ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(100);
`;

async function createTables() {
    await query(CREATE_TABLES_SQL);
    await query(MIGRATE_SQL);
}

async function hasSeedData() {
    const res = await query('SELECT EXISTS (SELECT 1 FROM users LIMIT 1) as has_data');
    return res.rows[0].has_data;
}

async function seedTestAccounts() {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    const owner = await query(
        `INSERT INTO users (email, password_hash, role, first_name, last_name, phone)
         VALUES ($1, $2, 'owner', $3, $4, $5) RETURNING id`,
        ['owner@medtap.test', passwordHash, 'Alex', 'Owner', '555-0100']
    );

    await query(
        `INSERT INTO users (email, password_hash, role, first_name, last_name, phone)
         VALUES ($1, $2, 'staff', $3, $4, $5)`,
        ['staff@medtap.test', passwordHash, 'Sam', 'Staff', '555-0101']
    );

    const patient = await query(
        `INSERT INTO users (email, password_hash, role, first_name, last_name, phone)
         VALUES ($1, $2, 'patient', $3, $4, $5) RETURNING id`,
        ['patient@medtap.test', passwordHash, 'Pat', 'Patient', '555-0102']
    );

    return { ownerId: owner.rows[0].id, patientId: patient.rows[0].id };
}

async function seedForm(ownerId, { title, description, appointmentType, blocks }) {
    const form = await query(
        `INSERT INTO forms (title, description, appointment_type, created_by_user_id)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [title, description, appointmentType, ownerId]
    );
    const formId = form.rows[0].id;

    for (const [label, blockType, options, isRequired, sortOrder] of blocks) {
        await query(
            `INSERT INTO form_blocks (form_id, label, block_type, options, is_required, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [formId, label, blockType, options, isRequired, sortOrder]
        );
    }

    return formId;
}

async function seedSampleForms(ownerId) {
    await seedForm(ownerId, {
        title: 'New Patient Intake',
        description: 'Standard intake form completed before a first visit.',
        appointmentType: 'New Patient',
        blocks: [
            ['Reason for Visit', 'textarea', null, true, 1],
            ['Date of Birth', 'date', null, true, 2],
            ['Preferred Pharmacy', 'text', null, false, 3],
            ['Any Known Allergies?', 'textarea', null, false, 4],
            ['Preferred Contact Method', 'select', JSON.stringify({ choices: ['Phone', 'Email', 'Text'] }), true, 5],
        ],
    });

    await seedForm(ownerId, {
        title: 'Follow-Up Visit Check-In',
        description: 'Quick check-in for returning patients.',
        appointmentType: 'Follow-Up',
        blocks: [
            ['What brings you back in today?', 'textarea', null, true, 1],
            ['Have your symptoms changed since your last visit?', 'select', JSON.stringify({ choices: ['Better', 'Same', 'Worse'] }), true, 2],
            ['Any new medications since your last visit?', 'textarea', null, false, 3],
        ],
    });
}

/**
 * Creates tables if they don't exist, and seeds test accounts + a sample
 * form the first time the app runs against a fresh database. Safe to call
 * on every server start — it never overwrites or deletes existing data.
 */
export async function setupDatabase() {
    await createTables();

    if (await hasSeedData()) {
        return;
    }

    console.log('No data found — seeding test accounts and sample forms...');
    const { ownerId } = await seedTestAccounts();
    await seedSampleForms(ownerId);
    console.log('Seed complete. Test accounts (password for all: P@$$w0rd!):');
    console.log('  owner@medtap.test  (role: owner)');
    console.log('  staff@medtap.test  (role: staff)');
    console.log('  patient@medtap.test (role: patient)');
}
