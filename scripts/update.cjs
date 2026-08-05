const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const getScopeFilterNew = `const getScopeFilter = async (user) => {
  if (!user) return { mongo: { _id: null }, memory: () => false };
  
  if (user.role === 'Admin') {
    return { mongo: {}, memory: () => true };
  } else if (user.role === 'State Manager') {
    const s = user.state || '';
    return { 
      mongo: { State: new RegExp('^' + s + '$', 'i') }, 
      memory: (item) => (item.State || '').toLowerCase() === s.toLowerCase()
    };
  } else if (user.role === 'District Manager') {
    const d = user.district || '';
    return { 
      mongo: { District: new RegExp('^' + d + '$', 'i') }, 
      memory: (item) => (item.District || '').toLowerCase() === d.toLowerCase()
    };
  } else {
    // Area Manager, CF, JCF
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
          ...(user.role === 'Area Manager' && user.areaName ? [{ Area: new RegExp('^' + user.areaName + '$', 'i') }] : []),
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
};`;

content = content.replace(/const getScopeFilter = \(user\) => \{[\s\S]*?^\};\n/m, getScopeFilterNew + '\n');
content = content.replace(/const scope = getScopeFilter\(req\.user\);/g, 'const scope = await getScopeFilter(req.user);');

// 3. POST /api/installations
content = content.replace(
  /app\.post\('\/api\/installations', authenticateToken, async \(req, res\) => \{\n\s+const \{ installation, updatedPipe \} = req\.body;\n\s+try \{/g,
  `app.post('/api/installations', authenticateToken, async (req, res) => {
  const { installation, updatedPipe } = req.body;
  try {
    const scope = await getScopeFilter(req.user);
    if (installation && !scope.memory(installation)) return res.status(403).json({ error: 'Cannot create records outside your scope' });`
);

// 4. PUT /api/installations/:pipeId
content = content.replace(
  /const query = isObjId\n\s+\? \{ \$or: \[\{ Pipe_ID: targetId \}, \{ _id: targetId \}\] \}\n\s+: \{ Pipe_ID: new RegExp[^}]+\} \};\n\n\s+await Installation\.findOneAndUpdate\(query, updated, \{ new: true \}\);/g,
  `const scope = await getScopeFilter(req.user);
      const targetQuery = isObjId
        ? { $or: [{ Pipe_ID: targetId }, { _id: targetId }] }
        : { Pipe_ID: new RegExp('^' + targetId.replace(/[-[\\]{}()*+?.,\\\\^$|#\\s]/g, '\\\\$&') + '$', 'i') };
      const query = { $and: [targetQuery, scope.mongo] };

      const updatedDoc = await Installation.findOneAndUpdate(query, updated, { new: true });
      if (!updatedDoc) return res.status(403).json({ error: 'Permission denied or record not found' });`
);

content = content.replace(
  /inMemoryData\.installations = inMemoryData\.installations\.map\(\(i\) =>\n\s+i\.Pipe_ID\.toLowerCase\(\) === targetId\.toLowerCase\(\) \? \{ \.\.\.i, \.\.\.updated \} : i\n\s+\);/g,
  `const scope = await getScopeFilter(req.user);
      const targetIndex = inMemoryData.installations.findIndex((i) => i.Pipe_ID.toLowerCase() === targetId.toLowerCase());
      if (targetIndex !== -1 && scope.memory(inMemoryData.installations[targetIndex])) {
        inMemoryData.installations[targetIndex] = { ...inMemoryData.installations[targetIndex], ...updated };
      } else {
        return res.status(403).json({ error: 'Permission denied' });
      }`
);

// 5. DELETE /api/installations/:pipeId
content = content.replace(
  /const query = isObjId\n\s+\? \{ \$or: \[\{ Pipe_ID: targetId \}, \{ _id: targetId \}\] \}\n\s+: \{ Pipe_ID: new RegExp[^}]+\} \};\n\n\s+const foundInst = await Installation\.findOne\(query\);/g,
  `const scope = await getScopeFilter(req.user);
      const targetQuery = isObjId
        ? { $or: [{ Pipe_ID: targetId }, { _id: targetId }] }
        : { Pipe_ID: new RegExp('^' + targetId.replace(/[-[\\]{}()*+?.,\\\\^$|#\\s]/g, '\\\\$&') + '$', 'i') };
      const query = { $and: [targetQuery, scope.mongo] };

      const foundInst = await Installation.findOne(query);
      if (!foundInst) return res.status(403).json({ error: 'Permission denied or record not found' });`
);

// 6. POST /api/monitoring
content = content.replace(
  /app\.post\('\/api\/monitoring', authenticateToken, async \(req, res\) => \{\n\s+const \{ record \} = req\.body;\n\s+try \{/g,
  `app.post('/api/monitoring', authenticateToken, async (req, res) => {
  const { record } = req.body;
  try {
    const scope = await getScopeFilter(req.user);
    if (!scope.memory(record)) return res.status(403).json({ error: 'Cannot monitor records outside your scope' });`
);

// 7. PUT /api/pipes/:id
content = content.replace(
  /if \(isMongoConnected\) \{\n\s+await Pipe\.findOneAndUpdate\(\{ Pipe_ID: pipeId \}, updates\);/g,
  `if (isMongoConnected) {
      const scope = await getScopeFilter(req.user);
      const updatedDoc = await Pipe.findOneAndUpdate({ $and: [{ Pipe_ID: pipeId }, scope.mongo] }, updates);
      if (!updatedDoc) return res.status(403).json({ error: 'Permission denied or record not found' });`
);

fs.writeFileSync('server.js', content);
console.log('Successfully updated mutations');
