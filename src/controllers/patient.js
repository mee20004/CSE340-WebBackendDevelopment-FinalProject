import {
    listSessionsForPatient,
    getSessionById,
    getAnswersForSession,
    saveProgress,
    submitSession,
    cancelSession,
} from '../models/sessions.js';
import { getFormWithBlocks } from '../models/forms.js';

function parseAnswersFromBody(body) {
    const answers = {};
    for (const [key, value] of Object.entries(body.answers || {})) {
        const blockId = key.replace(/^field_/, '');
        answers[blockId] = Array.isArray(value) ? value.join(', ') : value;
    }
    return answers;
}

function keepOnlyCurrentBlockAnswers(answers, blocks) {
    const currentIds = new Set(blocks.map((b) => String(b.id)));
    const filtered = {};
    for (const [blockId, value] of Object.entries(answers)) {
        if (currentIds.has(String(blockId))) {
            filtered[blockId] = value;
        }
    }
    return filtered;
}

async function loadOwnEditableSession(req) {
    const session = await getSessionById(req.params.id);
    if (!session || session.patient_user_id !== req.session.user.id) {
        const err = new Error('Check-in session not found.');
        err.status = 404;
        throw err;
    }
    if (!['created', 'in_progress'].includes(session.status)) {
        const err = new Error('This check-in has already been submitted and can no longer be edited.');
        err.status = 403;
        throw err;
    }
    return session;
}

export async function dashboard(req, res) {
    const sessions = await listSessionsForPatient(req.session.user.id);
    res.render('patient/dashboard', { title: 'My Dashboard', sessions });
}

export async function checkinPage(req, res, next) {
    try {
        const session = await getSessionById(req.params.id);
        if (!session || session.patient_user_id !== req.session.user.id) {
            const err = new Error('Check-in session not found.');
            err.status = 404;
            return next(err);
        }
        const [form, answers] = await Promise.all([
            getFormWithBlocks(session.form_id),
            getAnswersForSession(session.id),
        ]);
        const readOnly = !['created', 'in_progress'].includes(session.status);
        res.render('patient/checkin', {
            title: form.title,
            session,
            form,
            answers,
            readOnly,
            errors: [],
            saved: req.query.saved === '1',
        });
    } catch (err) {
        next(err);
    }
}

export async function saveCheckin(req, res, next) {
    try {
        const session = await loadOwnEditableSession(req);
        const form = await getFormWithBlocks(session.form_id);
        const answers = keepOnlyCurrentBlockAnswers(parseAnswersFromBody(req.body), form.blocks);
        await saveProgress(session.id, answers);
        res.redirect(`/patient/checkin/${session.id}?saved=1`);
    } catch (err) {
        next(err);
    }
}

export async function submitCheckin(req, res, next) {
    try {
        const session = await loadOwnEditableSession(req);
        const form = await getFormWithBlocks(session.form_id);
        const answers = keepOnlyCurrentBlockAnswers(parseAnswersFromBody(req.body), form.blocks);

        const missing = form.blocks.filter((b) => b.is_required && !answers[b.id]?.trim());
        if (missing.length > 0) {
            return res.status(400).render('patient/checkin', {
                title: form.title,
                session,
                form,
                answers,
                readOnly: false,
                errors: missing.map((b) => ({ msg: `"${b.label}" is required.` })),
            });
        }

        await submitSession(session.id, answers);
        res.redirect('/patient/dashboard');
    } catch (err) {
        next(err);
    }
}

export async function cancelCheckin(req, res, next) {
    try {
        await cancelSession(req.params.id, req.session.user.id);
        res.redirect('/patient/dashboard');
    } catch (err) {
        next(err);
    }
}
