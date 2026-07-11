import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pool, { testConnection } from './src/models/db.js';
import { setupDatabase } from './src/models/setup.js';
import indexRouter from './src/routes/index.js';
import authRouter from './src/routes/auth.js';
import practiceRouter from './src/routes/practice.js';
import patientRouter from './src/routes/patient.js';
import { notFoundHandler, globalErrorHandler } from './src/middleware/errorHandler.js';
import { attachUserToViews } from './src/middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 3000;
const PgSession = connectPgSimple(session);

app.set('view engine', 'ejs');
app.set('views', './src/views');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

app.use(session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24,
    },
}));

app.use(attachUserToViews);

// Routes
app.use('/', authRouter);
app.use('/practice', practiceRouter);
app.use('/patient', patientRouter);
app.use('/', indexRouter);

// 404 
app.use(notFoundHandler);
app.use(globalErrorHandler);

app.listen(PORT, async () => {
    await setupDatabase();
    await testConnection();
    console.log(`Server is running on http://127.0.0.1:${PORT}`);
});
