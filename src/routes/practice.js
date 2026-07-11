import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { registerValidators } from '../middleware/validators.js';
import {
    dashboard,
    listForms,
    newFormPage,
    createFormSubmit,
    editFormPage,
    updateFormSubmit,
    deleteFormSubmit,
    newSessionPage,
    createSessionSubmit,
    sessionDetail,
    closeSessionSubmit,
    staffPage,
    createStaffSubmit,
    deleteStaffSubmit,
} from '../controllers/practice.js';

const router = Router();

// owner + staff
router.use(requireRole('owner', 'staff'));

router.get('/dashboard', dashboard);

router.get('/forms', listForms);
router.get('/sessions/new', newSessionPage);
router.post('/sessions/new', createSessionSubmit);
router.get('/sessions/:id', sessionDetail);
router.post('/sessions/:id/close', closeSessionSubmit);

// owner only
router.get('/forms/new', requireRole('owner'), newFormPage);
router.post('/forms/new', requireRole('owner'), createFormSubmit);
router.get('/forms/:id/edit', requireRole('owner'), editFormPage);
router.post('/forms/:id/edit', requireRole('owner'), updateFormSubmit);
router.post('/forms/:id/delete', requireRole('owner'), deleteFormSubmit);

router.get('/staff', requireRole('owner'), staffPage);
router.post('/staff', requireRole('owner'), registerValidators, createStaffSubmit);
router.post('/staff/:id/delete', requireRole('owner'), deleteStaffSubmit);

export default router;
