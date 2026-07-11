import bcrypt from 'bcrypt';
import { validationResult } from 'express-validator';
import { findUserByEmail, createUser } from '../models/users.js';

function redirectPathForRole(role) {
    return role === 'patient' ? '/patient/dashboard' : '/practice/dashboard';
}

function renderAuthPage(res, status, overrides = {}) {
    res.status(status).render('auth/index', {
        title: 'Log In',
        initialTab: 'login',
        loginErrors: [],
        loginOld: {},
        registerErrors: [],
        registerOld: {},
        ...overrides,
    });
}

export function showLoginForm(req, res) {
    renderAuthPage(res, 200, { initialTab: 'login' });
}

export function showRegisterForm(req, res) {
    renderAuthPage(res, 200, { initialTab: 'register' });
}

export async function registerPatient(req, res, next) {
    const errors = validationResult(req);
    const { email, password, firstName, lastName, phone } = req.body;

    if (!errors.isEmpty()) {
        return renderAuthPage(res, 400, {
            initialTab: 'register',
            registerErrors: errors.array(),
            registerOld: { email, firstName, lastName, phone },
        });
    }

    try {
        const existing = await findUserByEmail(email);
        if (existing) {
            return renderAuthPage(res, 400, {
                initialTab: 'register',
                registerErrors: [{ msg: 'An account with that email already exists.' }],
                registerOld: { email, firstName, lastName, phone },
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await createUser({
            email,
            passwordHash,
            role: 'patient',
            firstName,
            lastName,
            phone,
        });

        req.session.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            firstName: user.first_name,
            lastName: user.last_name,
        };
        res.redirect(redirectPathForRole(user.role));
    } catch (err) {
        next(err);
    }
}

export async function login(req, res, next) {
    const errors = validationResult(req);
    const { email, password } = req.body;
    const genericError = [{ msg: 'Incorrect email or password.' }];

    if (!errors.isEmpty()) {
        return renderAuthPage(res, 400, {
            initialTab: 'login',
            loginErrors: errors.array(),
            loginOld: { email },
        });
    }

    try {
        const user = await findUserByEmail(email);
        if (!user) {
            return renderAuthPage(res, 400, { initialTab: 'login', loginErrors: genericError, loginOld: { email } });
        }

        const passwordMatches = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatches) {
            return renderAuthPage(res, 400, { initialTab: 'login', loginErrors: genericError, loginOld: { email } });
        }

        req.session.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            firstName: user.first_name,
            lastName: user.last_name,
        };
        res.redirect(redirectPathForRole(user.role));
    } catch (err) {
        next(err);
    }
}

export function logout(req, res, next) {
    req.session.destroy((err) => {
        if (err) return next(err);
        res.redirect('/');
    });
}
