const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

// Patch POST /api/users
content = content.replace(
  /app\.post\('\/api\/users', (.*?)=> {\n\s+const \{ newUser \} = req\.body;\n\s+try \{/g,
  `app.post('/api/users', $1=> {
  const { newUser } = req.body;
  try {
    if (newUser.password) {
      newUser.passwordHash = bcrypt.hashSync(newUser.password, 10);
      delete newUser.password;
    }`
);

// Patch PUT /api/users/:id
content = content.replace(
  /app\.put\('\/api\/users\/:id', (.*?)=> {\n\s+const \{ id \} = req\.params;\n\s+const \{ updatedUser \} = req\.body;\n\s+try \{/g,
  `app.put('/api/users/:id', $1=> {
  const { id } = req.params;
  const { updatedUser } = req.body;
  try {
    if (updatedUser.password) {
      updatedUser.passwordHash = bcrypt.hashSync(updatedUser.password, 10);
      delete updatedUser.password;
    }`
);

fs.writeFileSync('server.js', content);
