const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('ï¿½ï¿½ Building server...');

// Build frontend first
console.log('í³¦ Building frontend...');
execSync('vite build', { stdio: 'inherit' });

// Copy server files to dist
console.log('í³ Copying server files...');
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

// Copy server directory
execSync('cp -r server dist/', { stdio: 'inherit' });
execSync('cp -r shared dist/', { stdio: 'inherit' });

// Copy necessary files
const filesToCopy = [
  'package.json',
  'drizzle.config.ts',
  'tsconfig.json'
];

filesToCopy.forEach(file => {
  if (fs.existsSync(file)) {
    execSync(`cp ${file} dist/`, { stdio: 'inherit' });
  }
});

console.log('âœ… Build completed!');
