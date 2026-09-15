// Minimal static file server for the CoreForm site.
// Mirrors the .htaccess extensionless-URL behaviour so local previews match production.
//   node serve.mjs        -> http://localhost:3000
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const ROOT = process.cwd();
const PORT = Number(process.env.PORT) || 3000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml':  'application/xml; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.pdf':  'application/pdf',
  '.woff2':'font/woff2',
  '.cer':  'application/x-x509-ca-cert',
};

const exists = async (p) => { try { return (await stat(p)).isFile(); } catch { return false; } };

const send = (res, code, body, type) => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
};

createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad request', 'text/plain; charset=utf-8');
  }

  // Block traversal outside the project root.
  const parts = normalize(pathname).split(/[/\\]+/).filter(Boolean);
  if (parts.includes('..')) {
    return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  }

  const candidates = [];
  if (pathname === '/' || pathname.endsWith('/')) {
    candidates.push(join(ROOT, parts.join(sep), 'index.html'));
  } else {
    candidates.push(join(ROOT, parts.join(sep)));
    // .htaccess rule 3: serve foo.html when /foo is requested.
    if (!extname(parts.at(-1) || "")) candidates.push(join(ROOT, parts.join(sep) + '.html'));
  }

  for (const file of candidates) {
    if (await exists(file)) {
      const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
      return send(res, 200, await readFile(file), type);
    }
  }

  // Custom 404 page, matching production's ErrorDocument.
  const notFound = join(ROOT, '404.html');
  if (await exists(notFound)) {
    return send(res, 404, await readFile(notFound), TYPES['.html']);
  }
  return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
}).listen(PORT, () => console.log(`Serving ${ROOT} at http://localhost:${PORT}`));
