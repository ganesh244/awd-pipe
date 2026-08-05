import bcrypt from 'bcryptjs';
console.log('admin', bcrypt.compareSync('admin', '$2b$10$V8iN/w5xPmTsvt/SEdlYf.0JwD9UZQ2aHcpnIs8g3GHMp90G7OjmC'));
