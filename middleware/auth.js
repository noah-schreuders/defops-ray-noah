const jwt = require("jsonwebtoken");

const isAuthorized = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, process.env.JWT_SECRET, (err, decodedToken) => {
            if (err) {
                return res.status(403).send('Invalid token');
            }
            req.user = decodedToken;
            next();
        });
    } else {
        return res.status(404).send('Token not found');
    }
}

const hasRole = (roles) => {
    return (req, res, next) => {
        if (roles.includes(req.user.role)) {
            next();
        }
        else {
            return res.status(403).json({message: "Unauthorized"});
        }
    };
}

const hasOpaqueToken = (req, res, next) => {
    const token = req.headers.opaque_token;
    if (token) {
        if (token === process.env.OPAQUE_CODE) {
            next();
        } else {
            return res.status(403).send('Invalid token');
        }
    } else {
        return res.status(404).send('Token not found');
    }
};
module.exports = {isAuthorized, hasRole, hasOpaqueToken};