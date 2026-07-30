import fs from 'node:fs';
import path from 'node:path';

const ALLOWED_FILES = [
  'src/lib/types/backend.ts',
  'src/lib/ai-contract-version.ts',
  'src/lib/contract-registry.ts',
];

function isAllowedFile(filePath) {
  if (filePath.includes('__tests__')) return true;
  for (const allowed of ALLOWED_FILES) {
    if (filePath.endsWith(allowed)) return true;
  }
  return false;
}

function scanDir(dir, errors) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, errors);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      if (!isAllowedFile(fullPath)) {
        checkFile(fullPath, errors);
      }
    }
  }
}

function checkFile(filePath, errors) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const regex = /["'](?:3\.0|4\.0|5\.0|6\.0)["']/g; // Removed 1.0 and 2.0 to ignore those base versions
  
  lines.forEach((line, index) => {
    let match;
    while ((match = regex.exec(line)) !== null) {
      errors.push(`${filePath}:${index + 1}: Found hardcoded contract version literal: ${match[0]}`);
    }
  });
}

function main() {
  const errors = [];
  scanDir('src', errors);
  if (errors.length > 0) {
    console.error('Architecture Fitness check failed:');
    errors.forEach(e => console.error(e));
    process.exit(1);
  } else {
    console.log('Architecture fitness check passed.');
  }
}

main();
