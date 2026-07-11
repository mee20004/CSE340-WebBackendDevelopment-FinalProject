import { body } from 'express-validator';

export const registerValidators = [
    body('email')
        .trim()
        .isEmail().withMessage('Enter a valid email address.')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    body('firstName')
        .trim()
        .notEmpty().withMessage('First name is required.'),
    body('lastName')
        .trim()
        .notEmpty().withMessage('Last name is required.'),
    body('phone')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 30 }).withMessage('Phone number is too long.'),
];

export const loginValidators = [
    body('email')
        .trim()
        .isEmail().withMessage('Enter a valid email address.')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required.'),
];
