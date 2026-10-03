import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";

async function main() {
  console.log("==> Step 1: Preparing build environment...");

  console.log("==> Step 2: Fetching pre-rendered index.html from production preview...");
  let html = "";
  try {
    const res = await fetch("http://127.0.0.1:8081/");
    if (res.ok) {
      html = await res.text();
      console.log(`    ✓ Successfully fetched pre-rendered HTML (${html.length} bytes).`);
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn(`    ! Could not fetch from http://127.0.0.1:8081/ (${err.message}). Trying port 3000...`);
    try {
      const res = await fetch("http://127.0.0.1:3000/");
      if (res.ok) {
        html = await res.text();
        console.log(`    ✓ Fetched HTML from dev server (${html.length} bytes).`);
      }
    } catch (err2) {
      console.error("    ✗ Failed to fetch HTML:", err2.message);
    }
  }

  if (!html) {
    throw new Error("Unable to obtain index.html for static bundle.");
  }

  console.log("==> Step 3: Preparing ZIP bundle for Hostinger public_html...");
  const zip = new JSZip();

  // 1. Add index.html
  zip.file("index.html", html);

  // 2. Add .htaccess
  if (existsSync("public/.htaccess")) {
    zip.file(".htaccess", readFileSync("public/.htaccess"));
    console.log("    ✓ Added .htaccess with Apache rewrite & caching rules.");
  }

  // 3. Add README-HOSTINGER.txt
  const readme = `=======================================================
CODEX DYNAMICS - HOSTINGER 1-CLICK DEPLOYMENT PACKAGE
=======================================================

HOW TO DEPLOY ON HOSTINGER (takes under 60 seconds):

1. Log in to your Hostinger hPanel (https://hpanel.hostinger.com).
2. Go to "Websites" -> Click "Manage" on your website.
3. Open "File Manager" -> Navigate to the "public_html" directory.
4. Upload this ZIP file ("hostinger-public_html.zip") directly into public_html.
5. Right-click the ZIP file and choose "Extract".
   (Extract directly into public_html, so index.html, .htaccess, assets/ and api/ sit in public_html).
6. That's it! Your website is 100% live immediately.

WHAT IS INCLUDED & WORKING:
- Complete High-Performance Frontend (React 19 + Tailwind CSS + Framer Motion)
- Apache .htaccess configured for Single Page Application (SPA) routing
- Full PHP SQLite Backend in /api/:
    * /api/public/content.php (Live website projects, client reviews, published blogs)
- Pre-seeded SQLite Database:
    * Pre-populated with your projects, categories, uploaded media, client reviews, and blogs.
    * Database is secured by .htaccess so visitors cannot download the raw .sqlite file.
- Admin CRM Access:
    * URL: https://yourdomain.com/admin
    * Default Email: admin@codexdynamics.com
    * Default Password: Admin123!
    (You can change your password anytime in the Admin CRM -> Settings tab)

=======================================================
`;
  zip.file("README-HOSTINGER.txt", readme);

  // Helper to add files from directory recursively
  function addDirectoryToZip(localDir, zipPrefix = "") {
    if (!existsSync(localDir)) return;
    const entries = readdirSync(localDir);
    for (const entry of entries) {
      const fullPath = join(localDir, entry);
      const zipPath = zipPrefix ? `${zipPrefix}/${entry}` : entry;
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        addDirectoryToZip(fullPath, zipPath);
      } else {
        zip.file(zipPath, readFileSync(fullPath));
      }
    }
  }

  // 4. Add compiled assets from .vercel/output/static/assets
  if (existsSync(".vercel/output/static/assets")) {
    console.log("    ✓ Adding compiled client assets (/assets)...");
    addDirectoryToZip(".vercel/output/static/assets", "assets");
  }

  // 5. Add public media and static folders
  const publicFolders = ["api", "hero", "services", "studio", "team", "work", "uploads"];
  for (const folder of publicFolders) {
    const src = join("public", folder);
    if (existsSync(src)) {
      console.log(`    ✓ Adding /${folder}...`);
      addDirectoryToZip(src, folder);
    }
  }

  // 6. Add root public files
  const rootPublicFiles = ["favicon.svg", "og.jpg", "robots.txt"];
  for (const f of rootPublicFiles) {
    const src = join("public", f);
    if (existsSync(src)) {
      zip.file(f, readFileSync(src));
    }
  }

  // 7. Add SQLite database
  if (existsSync(".data/database.sqlite")) {
    const dbBuffer = readFileSync(".data/database.sqlite");
    zip.file(".data/database.sqlite", dbBuffer);
    zip.file("database.sqlite", dbBuffer);
    console.log(`    ✓ Embedded pre-seeded SQLite database (${dbBuffer.length} bytes).`);
  }

  console.log("==> Step 4: Compressing ZIP file...");
  const content = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  const rootZipPath = "hostinger-public_html.zip";
  const publicZipPath = "public/hostinger-public_html.zip";

  writeFileSync(rootZipPath, content);
  writeFileSync(publicZipPath, content);

  console.log(`==> SUCCESS! Hostinger ZIP generated:`);
  console.log(`    - File Size: ${(content.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`    - Workspace Location: ${rootZipPath}`);
  console.log(`    - Browser Download Location: ${publicZipPath}`);
}

main().catch((err) => {
  console.error("FATAL ERROR creating Hostinger zip:", err);
  process.exit(1);
});
