export function notFoundHandler(req, res, next) {
    const err = new Error(`Page not found: ${req.originalUrl}`);
    err.status = 404;
    next(err);
}

const VIEW_BY_STATUS = {
    403: { view: 'errors/403', title: 'Access Denied' },
    404: { view: 'errors/404', title: 'Page Not Found' },
};

export function globalErrorHandler(err, req, res, next) {
    const status = err.status || 500;
    const { view, title } = VIEW_BY_STATUS[status] || { view: 'errors/500', title: 'Something Went Wrong' };

    if (status >= 500) {
        console.error(err);
    }

    res.status(status).render(view, {
        title,
        message: process.env.NODE_ENV === 'production' && status >= 500
            ? 'An unexpected error occurred.'
            : err.message,
    });
}
