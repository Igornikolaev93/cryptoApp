const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
    const token = req.headers['x-auth-token'];
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Токен не предоставлен'
        });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(401).json({
            success: false,
            message: 'Недействительный токен'
        });
    }
}

module.exports = authMiddleware;