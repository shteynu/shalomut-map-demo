import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ALLOWED_FILES = [
  'src/lib/types/backend.ts',
  'src/lib/ai-contract.ts',
  'src/lib/ai-contract-version.ts',
  'src/lib/contract-registry.ts',
  'src/lib/services/analytics.service.ts',
];

const VERSION_LITERAL = /["']([1-6]\.0)["']/g;
const VERSION_IDENTIFIER =
  /AI_ANALYTICS_(?:V\d+_|DYNAMIC_|SUPPORTED_)?CONTRACT_VERSIONS?/;
const COMPARISON = /===|!==|==|!=|\.includes\s*\(/;

function isAllowedFile(filePath) {
  if (filePath.includes('__tests__')) return true;
  return ALLOWED_FILES.some((allowed) => filePath.endsWith(allowed));
}

export function findVersionBranching(source, filePath = '<source>') {
  const errors = [];
  const lines = source.split('\n');

  lines.forEach((line, index) => {
    VERSION_LITERAL.lastIndex = 0;
    let match;
    while ((match = VERSION_LITERAL.exec(line)) !== null) {
      const isJsonRpc = /jsonrpc/i.test(line);
      const isContractContext = /contract.?version/i.test(line);
      if (
        !isJsonRpc &&
        (isContractContext || Number(match[1]) >= 3 || COMPARISON.test(line))
      ) {
        errors.push(
          `${filePath}:${index + 1}: Found hardcoded contract version literal: ${match[0]}`,
        );
      }
    }

    if (VERSION_IDENTIFIER.test(line) && COMPARISON.test(line)) {
      errors.push(
        `${filePath}:${index + 1}: Found contract-version branching through a named constant`,
      );
    }
  });

  // Catch multiline membership checks such as
  // [AI_ANALYTICS_V4_CONTRACT_VERSION, ...].includes(version).
  const multilineBranch = new RegExp(
    `${VERSION_IDENTIFIER.source}[\\s\\S]{0,300}?\\.includes\\s*\\(`,
    'g',
  );
  for (const match of source.matchAll(multilineBranch)) {
    const line = source.slice(0, match.index).split('\n').length;
    const message = `${filePath}:${line}: Found contract-version branching through a named constant`;
    if (!errors.includes(message)) errors.push(message);
  }

  const multilineComparison = new RegExp(
    `(?:${VERSION_IDENTIFIER.source}[\\s\\S]{0,120}?(?:===|!==|==|!=)|` +
      `(?:===|!==|==|!=)[\\s\\S]{0,120}?${VERSION_IDENTIFIER.source})`,
    'g',
  );
  for (const match of source.matchAll(multilineComparison)) {
    const line = source.slice(0, match.index).split('\n').length;
    const message = `${filePath}:${line}: Found contract-version branching through a named constant`;
    if (!errors.includes(message)) errors.push(message);
  }

  return errors;
}

function scanDir(dir, errors) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, errors);
    } else if (
      (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) &&
      !isAllowedFile(fullPath)
    ) {
      errors.push(
        ...findVersionBranching(fs.readFileSync(fullPath, 'utf-8'), fullPath),
      );
    }
  }
}

function main() {
  const errors = [];
  scanDir('src', errors);
  if (errors.length > 0) {
    console.error('Architecture fitness check failed:');
    errors.forEach((error) => console.error(error));
    process.exit(1);
  }
  console.log('Architecture fitness check passed.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
