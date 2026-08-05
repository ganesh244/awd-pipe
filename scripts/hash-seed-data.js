import fs from 'fs';
import bcrypt from 'bcryptjs';

const filePath = 'src/data/hierarchyData.ts';
let content = fs.readFileSync(filePath, 'utf8');

const passwordRegex = /password:\s*'([^']+)',/g;

let match;
const replacements = [];

while ((match = passwordRegex.exec(content)) !== null) {
  replacements.push({
    fullMatch: match[0],
    plainText: match[1]
  });
}

const hashAll = async () => {
  let newContent = content;
  for (const r of replacements) {
    const hash = await bcrypt.hash(r.plainText, 10);
    newContent = newContent.replace(r.fullMatch, `passwordHash: '${hash}',`);
  }
  fs.writeFileSync(filePath, newContent);
  console.log('Successfully hashed passwords in hierarchyData.ts');
};

hashAll();
