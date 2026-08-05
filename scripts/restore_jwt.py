import re

with open("server.js", "r") as f:
    content = f.read()

imports = """import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
"""

content = content.replace("import mongoose from 'mongoose';", "import mongoose from 'mongoose';\n" + imports)

middlewares = """
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-dev';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts' }
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

const getScopeFilter = async (user) => {
  if (!user) return { mongo: { _id: null }, memory: () => false };
  
  if (user.role === 'Admin') {
    return { mongo: {}, memory: () => true };
  } else if (user.role === 'State Manager') {
    const s = user.state || '';
    return { 
      mongo: { State: new RegExp('^' + s.replace(/[-[\]{}()*+?.,\\\\^$|#\s]/g, '\\\\$&') + '$', 'i') }, 
      memory: (item) => (item.State || '').toLowerCase() === s.toLowerCase()
    };
  } else if (user.role === 'District Manager') {
    const d = user.district || '';
    return { 
      mongo: { District: new RegExp('^' + d.replace(/[-[\]{}()*+?.,\\\\^$|#\s]/g, '\\\\$&') + '$', 'i') }, 
      memory: (item) => (item.District || '').toLowerCase() === d.toLowerCase()
    };
  } else {
    let allUsers = [];
    if (isMongoConnected) {
      allUsers = await User.find({}).lean();
    } else {
      allUsers = inMemoryData.users;
    }
    
    const subUserIds = new Set([user.id]);
    let added = true;
    while (added) {
      added = false;
      for (const u of allUsers) {
        if (subUserIds.has(u.id)) continue;
        const directReport = u.reportsToId && subUserIds.has(u.reportsToId);
        const createdReport = u.createdById && subUserIds.has(u.createdById);
        if (directReport || createdReport) {
          subUserIds.add(u.id);
          added = true;
        }
      }
    }
    
    const subIdsArray = Array.from(subUserIds);
    const subNames = allUsers.filter(u => subUserIds.has(u.id)).map(u => (u.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean);
    const nameRegexes = subNames.map(n => new RegExp(n.split('').join('.*'), 'i'));

    return {
      mongo: {
        $or: [
          { Registered_By_User_ID: { $in: subIdsArray } },
          { Visited_By_User_ID: { $in: subIdsArray } },
          ...(user.role === 'Area Manager' && user.areaName ? [{ Area: new RegExp('^' + user.areaName.replace(/[-[\]{}()*+?.,\\\\^$|#\s]/g, '\\\\$&') + '$', 'i') }] : []),
          ...(nameRegexes.length > 0 ? [{ Installed_By: { $in: nameRegexes } }] : [])
        ]
      },
      memory: (item) => {
        if (item.Registered_By_User_ID && subUserIds.has(item.Registered_By_User_ID)) return true;
        if (item.Visited_By_User_ID && subUserIds.has(item.Visited_By_User_ID)) return true;
        if (user.role === 'Area Manager' && item.Area && item.Area.toLowerCase() === (user.areaName || '').toLowerCase()) return true;
        if (item.Installed_By) {
          const iNorm = (item.Installed_By || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          if (subNames.some(sName => sName.length >= 2 && (iNorm.includes(sName) || sName.includes(iNorm)))) return true;
        }
        return false;
      }
    };
  }
};
"""

content = content.replace("// API Endpoints", middlewares + "\n// API Endpoints")

login_endpoint = """
app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Required' });
  try {
    let user = null;
    if (isMongoConnected) user = await User.findOne({ username: username.trim() }).lean();
    else user = inMemoryData.users.find((u) => u.username === username.trim());
    
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    let isValid = false;
    if (user.passwordHash) isValid = await bcrypt.compare(password, user.passwordHash);
    else if (user.password === password) isValid = true;
    
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign(
      { id: user.id, role: user.role, state: user.state, district: user.district, areaName: user.areaName, name: user.name },
      JWT_SECRET,
      { expiresIn: '4h' }
    );
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});
"""
content = content.replace("// API Endpoints", "// API Endpoints\n" + login_endpoint)

content = content.replace("app.get('/api/init', async (req, res) => {", "app.get('/api/init', authenticateToken, async (req, res) => {")
content = content.replace("const latestPipes = isMongoConnected ? await Pipe.find({}).lean() : inMemoryData.pipes;", 
                          "const scope = await getScopeFilter(req.user);\n    const latestPipes = isMongoConnected ? await Pipe.find(scope.mongo).lean() : inMemoryData.pipes.filter(scope.memory);")
content = content.replace("const latestInstallations = isMongoConnected ? await Installation.find({}).lean() : inMemoryData.installations;",
                          "const latestInstallations = isMongoConnected ? await Installation.find(scope.mongo).lean() : inMemoryData.installations.filter(scope.memory);")
content = content.replace("const latestMonitoring = isMongoConnected ? await Monitoring.find({}).lean() : inMemoryData.monitoringList;",
                          "const latestMonitoring = isMongoConnected ? await Monitoring.find(scope.mongo).lean() : inMemoryData.monitoringList.filter(scope.memory);")

mutations = [
  ("app.post('/api/installations', async (req, res) => {", "app.post('/api/installations', authenticateToken, async (req, res) => {\n  const scope = await getScopeFilter(req.user);\n  if (req.body.installation && !scope.memory(req.body.installation)) return res.status(403).json({ error: 'Out of scope' });"),
  ("app.put('/api/installations/:pipeId', async (req, res) => {", "app.put('/api/installations/:pipeId', authenticateToken, async (req, res) => {\n  const scope = await getScopeFilter(req.user);"),
  ("app.delete('/api/installations/:pipeId', async (req, res) => {", "app.delete('/api/installations/:pipeId', authenticateToken, async (req, res) => {\n  const scope = await getScopeFilter(req.user);"),
  ("app.post('/api/monitoring', async (req, res) => {", "app.post('/api/monitoring', authenticateToken, async (req, res) => {\n  const scope = await getScopeFilter(req.user);\n  if (req.body.record && !scope.memory(req.body.record)) return res.status(403).json({ error: 'Out of scope' });"),
  ("app.post('/api/pipes/batch', async (req, res) => {", "app.post('/api/pipes/batch', authenticateToken, async (req, res) => {\n  if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });"),
  ("app.put('/api/pipes/:id', async (req, res) => {", "app.put('/api/pipes/:id', authenticateToken, async (req, res) => {\n  const scope = await getScopeFilter(req.user);"),
  ("app.put('/api/pipes/batch/rename', async (req, res) => {", "app.put('/api/pipes/batch/rename', authenticateToken, async (req, res) => {\n  if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });"),
  ("app.delete('/api/pipes/batch/:batchNo', async (req, res) => {", "app.delete('/api/pipes/batch/:batchNo', authenticateToken, async (req, res) => {\n  if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });")
]

for old, new_ in mutations:
    content = content.replace(old, new_)

# Update mongodb queries for the above
content = content.replace(
  "await Installation.findOneAndUpdate(query, updated, { new: true });",
  "await Installation.findOneAndUpdate({ $and: [query, scope.mongo] }, updated, { new: true });"
)
content = content.replace(
  "const foundInst = await Installation.findOne(query);",
  "const foundInst = await Installation.findOne({ $and: [query, scope.mongo] });"
)
content = content.replace(
  "await Pipe.findOneAndUpdate({ Pipe_ID: pipeId }, updates);",
  "await Pipe.findOneAndUpdate({ $and: [{ Pipe_ID: pipeId }, scope.mongo] }, updates);"
)

# Admin only for hierarchy
content = re.sub(r"(app\.(post|put|delete)\('/api/hierarchy.*?', )async", r"\1authenticateToken, async (req, res, next) => { if (req.user.role !== 'Admin') return res.status(403).json({error: 'Admin only'}); return next(); }, async", content)
content = re.sub(r"(app\.(post|put|delete)\('/api/users.*?', )async", r"\1authenticateToken, async (req, res, next) => { if (req.user.role !== 'Admin') return res.status(403).json({error: 'Admin only'}); return next(); }, async", content)
content = re.sub(r"(app\.get\('/api/users', )async", r"\1authenticateToken, async (req, res, next) => { if (req.user.role !== 'Admin') return res.status(403).json({error: 'Admin only'}); return next(); }, async", content)

with open("server.js", "w") as f:
    f.write(content)
