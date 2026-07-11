export function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
}

export function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.redirect('/login');
        }
        if (!allowedRoles.includes(req.session.user.role)) {
            const err = new Error("You don't have permission to view this page.");
            err.status = 403;
            return next(err);
        }
        next();
    };
}

export function attachUserToViews(req, res, next) {
    res.locals.currentUser = req.session.user || null;
    next();
}
