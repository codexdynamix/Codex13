import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import type { Plugin } from 'vite';

export function crmApiPlugin(): Plugin {
  return {
    name: 'codex-hostinger-export',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url || '/', 'http://localhost').pathname;
        if (pathname !== '/api/download-hostinger-zip') return next();

        try {
          const appDir = path.resolve(import.meta.dirname, '../..');
          const publicDir = path.resolve(appDir, 'public');
          const zip = new JSZip();
          const readmePath = path.join(publicDir, 'README-HOSTINGER.txt');
          const htaccessPath = path.join(publicDir, '.htaccess');

          if (fs.existsSync(readmePath)) {
            zip.file('README-HOSTINGER.txt', fs.readFileSync(readmePath, 'utf8'));
          }
          if (fs.existsSync(htaccessPath)) {
            zip.file('.htaccess', fs.readFileSync(htaccessPath, 'utf8'));
          }

          const addDirectory = (directory: string, target: JSZip, excludePrivateData = false) => {
            for (const name of fs.readdirSync(directory)) {
              if (excludePrivateData && ['data', 'config.php'].includes(name)) continue;
              const source = path.join(directory, name);
              const stat = fs.statSync(source);
              if (stat.isDirectory()) {
                addDirectory(source, target.folder(name)!, excludePrivateData);
              } else {
                target.file(name, fs.readFileSync(source));
              }
            }
          };

          const apiDir = path.join(publicDir, 'api');
          if (fs.existsSync(apiDir)) addDirectory(apiDir, zip.folder('api')!, true);

          const distPublicDir = path.join(appDir, 'dist', 'public');
          if (fs.existsSync(distPublicDir)) addDirectory(distPublicDir, zip);

          const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/zip');
          res.setHeader('Content-Disposition', 'attachment; filename="hostinger-public_html.zip"');
          res.end(archive);
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            ok: false,
            error: error instanceof Error ? error.message : 'Failed to create the hosting archive.',
          }));
        }
      });
    },
  };
}