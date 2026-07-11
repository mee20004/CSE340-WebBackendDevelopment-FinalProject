import { Router } from 'express';
import {
    showRegisterForm,
    registerPatient,
    showLoginForm,
    login,
    logout,
} from '../controllers/auth.js';
import { registerValidators, loginValidators } from '../middleware/validators.js';

const router = Router();

router.get('/patient/register', showRegisterForm);
router.post('/patient/register', registerValidators, registerPatient);

router.get('/login', showLoginForm);
router.post('/login', loginValidators, login);

router.post('/logout', logout);

export default router;
