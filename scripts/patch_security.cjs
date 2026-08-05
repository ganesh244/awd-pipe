const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

// 1. Remove plaintext password comparison
content = content.replace(
  /else if \(user\.password === password\) isValid = true;/g,
  `// Removed insecure plaintext fallback`
);

// 2. Remove insecure JWT fallback
content = content.replace(
  /const JWT_SECRET = process\.env\.JWT_SECRET \|\| 'fallback-secret-key-for-dev';/g,
  `const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET not set in environment. Using securely generated ephemeral secret.');
}
const ACTIVE_JWT_SECRET = JWT_SECRET || require('crypto').randomBytes(32).toString('hex');`
);
content = content.replace(
  /jwt\.verify\(token, JWT_SECRET, /g,
  `jwt.verify(token, ACTIVE_JWT_SECRET, `
);
content = content.replace(
  /JWT_SECRET,/g,
  `ACTIVE_JWT_SECRET,`
);

// 3. Add auth to /api/installations/clear/all
content = content.replace(
  /app\.delete\('\/api\/installations\/clear\/all', async \(req, res\) => {/g,
  `app.delete('/api/installations/clear/all', authenticateToken, async (req, res, next) => { if (req.user.role !== 'Admin') return res.status(403).json({error: 'Admin only'}); return next(); }, async (req, res) => {`
);

fs.writeFileSync('server.js', content);
