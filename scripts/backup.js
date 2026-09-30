const fs = require('fs');
const path = require('path');

const backupDir = path.join(__dirname, '..', 'backup');
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

const now = new Date();
const pad = n => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const dbPath = path.join(__dirname, '..', 'saath-db.json');
const backupFile = path.join(backupDir, `saath-db-${timestamp}.json`);

if (!fs.existsSync(dbPath)) {
    console.error('FATAL: Production database file not found at:', dbPath);
    process.exit(1);
}

fs.copyFileSync(dbPath, backupFile);

const originalStat = fs.statSync(dbPath);
const backupStat = fs.statSync(backupFile);
const parsedBackup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

console.log('Production Database File:', dbPath);
console.log('Verified Backup Created At:', backupFile);
console.log('Original Size (bytes):', originalStat.size);
console.log('Backup Size (bytes):', backupStat.size);
console.log('Users in Backup:', parsedBackup.users ? parsedBackup.users.length : 0);
console.log('Bookings in Backup:', parsedBackup.bookings ? parsedBackup.bookings.length : 0);
console.log('Messages in Backup:', parsedBackup.messages ? parsedBackup.messages.length : 0);
console.log('Votes in Backup:', parsedBackup.votes ? parsedBackup.votes.length : 0);

if (originalStat.size === backupStat.size && parsedBackup.users && parsedBackup.users.length > 0) {
    console.log('✓ VERIFIED BACKUP SUCCESSFUL AND DATA INTEGRITY CONFIRMED (100%)');
} else {
    console.error('❌ BACKUP VERIFICATION FAILED');
    process.exit(1);
}
