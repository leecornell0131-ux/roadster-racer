// Builds dist/artifact.html: the page fragment (no doctype/html/head/body) for a claude.ai artifact.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const html = readFileSync('index.html', 'utf8');
const body = html.split('<!-- ARTIFACT-START -->')[1].split('<!-- ARTIFACT-END -->')[0]
  .replace('</head>\n<body>\n', '');
mkdirSync('dist', { recursive: true });
writeFileSync('dist/artifact.html', body.trim() + '\n');
console.log('dist/artifact.html', body.length, 'bytes');
