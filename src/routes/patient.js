import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import {
    dashboard,
    checkinPage,
    saveCheckin,
    submitCheckin,
    cancelCheckin,
} from '../controllers/patient.js';

const router = Router();

router.use(requireRole('patient'));

router.get('/dashboard', dashboard);
router.get('/checkin/:id', checkinPage);
router.post('/checkin/:id/save', saveCheckin);
router.post('/checkin/:id/submit', submitCheckin);
router.post('/checkin/:id/cancel', cancelCheckin);

export default router;
