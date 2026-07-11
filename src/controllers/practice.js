import bcrypt from 'bcrypt';
import { validationResult } from 'express-validator';
import {
    listActiveForms,
    listAllForms,
    listAppointmentTypes,
    getFormWithBlocks,
    createForm,
    updateForm,
    deleteForm,
} from '../models/forms.js';
import {
    createSession,
    listSessionsForPractice,
    getSessionById,
    getAnswersForSession,
    closeSession,
} from '../models/sessions.js';
import {
    listStaff,
    listPatients,
    createUser,
    deleteStaffById,
    findUserByEmail,
} from '../models/users.js';

function parseBlocksFromBody(body) {
    const raw = Object.values(body.blocks || {});
    return raw
        .filter((b) => b.label && b.label.trim())
        .map((b) => ({
            label: b.label.trim(),
            blockType: b.blockType,
            isRequired: b.isRequired === 'on',
            options: b.blockType === 'select' && b.optionsText
                ? { choices: b.optionsText.split(',').map((c) => c.trim()).filter(Boolean) }
                : null,
        }));
}

export async function dashboard(req, res) {
    const sessions = await listSessionsForPractice();
    res.render('practice/dashboard', { title: 'Practice Dashboard', sessions });
}

// Forms

export async function listForms(req, res) {
    const forms = await listAllForms();
    res.render('practice/forms-list', { title: 'Forms', forms, error: req.query.error });
}

export function newFormPage(req, res) {
    res.render('practice/form-edit', {
        title: 'New Form',
        form: { title: '', description: '', appointment_type: '', is_active: true, blocks: [] },
        errors: [],
    });
}

export async function createFormSubmit(req, res, next) {
    const { title, description, appointmentType } = req.body;
    const blocks = parseBlocksFromBody(req.body);
    const errors = [];

    if (!title || !title.trim()) errors.push({ msg: 'Form title is required.' });
    if (blocks.length === 0) errors.push({ msg: 'Add at least one field to the form.' });

    if (errors.length) {
        return res.status(400).render('practice/form-edit', {
            title: 'New Form',
            form: { title, description, appointment_type: appointmentType, is_active: true, blocks },
            errors,
        });
    }

    try {
        await createForm(
            { title: title.trim(), description, appointmentType, createdByUserId: req.session.user.id },
            blocks
        );
        res.redirect('/practice/forms');
    } catch (err) {
        next(err);
    }
}

export async function editFormPage(req, res, next) {
    try {
        const form = await getFormWithBlocks(req.params.id);
        if (!form) {
            const err = new Error('Form not found.');
            err.status = 404;
            return next(err);
        }
        res.render('practice/form-edit', { title: `Edit: ${form.title}`, form, errors: [] });
    } catch (err) {
        next(err);
    }
}

export async function updateFormSubmit(req, res, next) {
    const { title, description, appointmentType } = req.body;
    const isActive = req.body.isActive === 'on';
    const blocks = parseBlocksFromBody(req.body);
    const errors = [];

    if (!title || !title.trim()) errors.push({ msg: 'Form title is required.' });
    if (blocks.length === 0) errors.push({ msg: 'Add at least one field to the form.' });

    if (errors.length) {
        return res.status(400).render('practice/form-edit', {
            title: 'Edit Form',
            form: { id: req.params.id, title, description, appointment_type: appointmentType, is_active: isActive, blocks },
            errors,
        });
    }

    try {
        await updateForm(
            req.params.id,
            { title: title.trim(), description, appointmentType, isActive },
            blocks
        );
        res.redirect('/practice/forms');
    } catch (err) {
        next(err);
    }
}

export async function deleteFormSubmit(req, res, next) {
    try {
        await deleteForm(req.params.id);
        res.redirect('/practice/forms');
    } catch (err) {
        if (err.code === '23503') {
            return res.redirect('/practice/forms?error=' + encodeURIComponent(
                'This form has check-in history and cannot be deleted. Deactivate it instead by editing it.'
            ));
        }
        next(err);
    }
}

// Sessions

export async function newSessionPage(req, res) {
    const [forms, patients, appointmentTypes] = await Promise.all([
        listActiveForms(),
        listPatients(),
        listAppointmentTypes(),
    ]);
    res.render('practice/session-new', { title: 'New Check-In', forms, patients, appointmentTypes, errors: [] });
}

export async function createSessionSubmit(req, res, next) {
    const { patientUserId, formId } = req.body;
    if (!patientUserId || !formId) {
        const [forms, patients, appointmentTypes] = await Promise.all([
            listActiveForms(),
            listPatients(),
            listAppointmentTypes(),
        ]);
        return res.status(400).render('practice/session-new', {
            title: 'New Check-In',
            forms,
            patients,
            appointmentTypes,
            errors: [{ msg: 'Select both a patient and a form.' }],
        });
    }

    try {
        const sessionId = await createSession({
            patientUserId,
            formId,
            createdByUserId: req.session.user.id,
        });
        res.redirect(`/practice/sessions/${sessionId}`);
    } catch (err) {
        next(err);
    }
}

export async function sessionDetail(req, res, next) {
    try {
        const session = await getSessionById(req.params.id);
        if (!session) {
            const err = new Error('Check-in session not found.');
            err.status = 404;
            return next(err);
        }
        const [form, answers] = await Promise.all([
            getFormWithBlocks(session.form_id),
            getAnswersForSession(session.id),
        ]);
        res.render('practice/session-detail', { title: 'Check-In Detail', session, form, answers });
    } catch (err) {
        next(err);
    }
}

export async function closeSessionSubmit(req, res, next) {
    try {
        await closeSession(req.params.id);
        res.redirect(`/practice/sessions/${req.params.id}`);
    } catch (err) {
        next(err);
    }
}

// (owner only)

export async function staffPage(req, res) {
    const staff = await listStaff();
    res.render('practice/staff', { title: 'Manage Staff', staff, errors: [], old: {} });
}

export async function createStaffSubmit(req, res, next) {
    const errors = validationResult(req);
    const { email, password, firstName, lastName, phone } = req.body;

    if (!errors.isEmpty()) {
        const staff = await listStaff();
        return res.status(400).render('practice/staff', {
            title: 'Manage Staff',
            staff,
            errors: errors.array(),
            old: { email, firstName, lastName, phone },
        });
    }

    try {
        const existing = await findUserByEmail(email);
        if (existing) {
            const staff = await listStaff();
            return res.status(400).render('practice/staff', {
                title: 'Manage Staff',
                staff,
                errors: [{ msg: 'An account with that email already exists.' }],
                old: { email, firstName, lastName, phone },
            });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        await createUser({ email, passwordHash, role: 'staff', firstName, lastName, phone });
        res.redirect('/practice/staff');
    } catch (err) {
        next(err);
    }
}

export async function deleteStaffSubmit(req, res, next) {
    try {
        await deleteStaffById(req.params.id);
        res.redirect('/practice/staff');
    } catch (err) {
        next(err);
    }
}
