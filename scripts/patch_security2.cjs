const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

content = content.replace(
  /const ACTIVE_JWT_SECRET = JWT_SECRET \|\| require\('crypto'\)\.randomBytes\(32\)\.toString\('hex'\);/g,
  `import crypto from 'crypto';\nconst ACTIVE_JWT_SECRET = JWT_SECRET || crypto.randomBytes(32).toString('hex');`
);

fs.writeFileSync('server.js', content);
