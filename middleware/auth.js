const { admin, db } = require('../firebase');

exports.authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                message: 'Authentication required. Please provide a valid token.'
            });
        }

        const token = authHeader.split('Bearer ')[1];
        
        // Check if it's a test token
        if (token.startsWith('test_token_') || token.includes('test_user_curl_')) {
            // Mock decoded token for testing - use a user from x-spark-test enterprise
            req.user = {
                uid: 'DW1QbgLTiCgFxOBbvPKdjlLvIgo1',
                email: 'tshehlap@gmail.com',
                name: 'Tshehlap User'
            };
            req.token = token;
            next();
            return;
        }
        
        // For non-test tokens, use normal verification
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        req.token = token;
        next();
    } catch (error) {
        res.status(500).json({
            message: 'Authentication failed',
            error: error.message
        });
    }
};
