/**
 * AuthHub Universal Node.js / Express SDK Helper
 * Copy or import this file into any Node.js project in `project/*` to verify AuthHub SSO JWT tokens.
 *
 * Usage in Express:
 *   const { requireAuthHub } = require('./auth-hub-sdk');
 *   app.get('/api/protected', requireAuthHub({ clientSlug: 'uploadbox', minRole: 'viewer' }), (req, res) => {
 *     res.json({ user: req.authUser });
 *   });
 */

const AUTH_HUB_URL = process.env.AUTH_HUB_URL || 'http://localhost:4100';

const ROLE_WEIGHT = {
  none: 0,
  viewer: 1,
  editor: 2,
  admin: 3,
  superadmin: 4,
};

function requireAuthHub(options = {}) {
  const { clientSlug = 'common', minRole = 'viewer' } = options;

  return async function authHubMiddleware(req, res, next) {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : req.query.token;

      if (!token) {
        return res.status(401).json({ error: 'Missing AuthHub Bearer token' });
      }

      const response = await fetch(`${AUTH_HUB_URL}/api/v1/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, clientSlug }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        return res.status(401).json({ error: errBody.error || 'Invalid or expired SSO token' });
      }

      const data = await response.json();
      const userRole = data.appRole || 'none';

      if ((ROLE_WEIGHT[userRole] || 0) < (ROLE_WEIGHT[minRole] || 1)) {
        return res.status(403).json({
          error: `Insufficient role for ${clientSlug}. Required: ${minRole}, current: ${userRole}`,
        });
      }

      req.authUser = data.user;
      req.authRole = userRole;
      next();
    } catch (err) {
      return res.status(500).json({ error: 'AuthHub verification error: ' + err.message });
    }
  };
}

module.exports = { requireAuthHub };

