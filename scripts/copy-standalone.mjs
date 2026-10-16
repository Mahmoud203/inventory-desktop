import fs from "fs";
import path from "path";

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.lstatSync(src);

  if (stat.isSymbolicLink()) {
    const realTarget = fs.realpathSync(src);
    copyRecursive(realTarget, dest);
    return;
  }

  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function resolveSymlinksInDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      try {
        const realTarget = fs.realpathSync(fullPath);
        console.log(`Resolving symlink into real folder: ${fullPath} -> ${realTarget}`);
        fs.unlinkSync(fullPath);
        copyRecursive(realTarget, fullPath);
      } catch (err) {
        console.warn(`Could not resolve symlink ${fullPath}:`, err.message);
      }
    } else if (entry.isDirectory()) {
      resolveSymlinksInDir(fullPath);
    }
  }
}

async function main() {
  const standaloneDir = path.join(process.cwd(), ".next", "standalone");
  if (!fs.existsSync(standaloneDir)) {
    console.error("Error: .next/standalone does not exist. Run 'next build' first.");
    process.exit(1);
  }

  // 1. Clean up extraneous folders (e.g. dist-electron or data copied by Next.js standalone tracing)
  for (const unwanted of ["dist-electron", "data"]) {
    const p = path.join(standaloneDir, unwanted);
    if (fs.existsSync(p)) {
      console.log(`Cleaning up unwanted folder: ${p}`);
      fs.rmSync(p, { recursive: true, force: true });
    }
  }

  // 2. Resolve any symlinks inside .next/standalone (e.g. better-sqlite3 symlink created on Windows)
  console.log("Resolving symlinks in .next/standalone...");
  resolveSymlinksInDir(standaloneDir);

  // 2. Copy .next/static to .next/standalone/.next/static
  const staticSrc = path.join(process.cwd(), ".next", "static");
  const staticDest = path.join(standaloneDir, ".next", "static");
  console.log(`Copying ${staticSrc} to ${staticDest}...`);
  copyRecursive(staticSrc, staticDest);

  // 3. Copy public to .next/standalone/public
  const publicSrc = path.join(process.cwd(), "public");
  const publicDest = path.join(standaloneDir, "public");
  console.log(`Copying ${publicSrc} to ${publicDest}...`);
  copyRecursive(publicSrc, publicDest);

  console.log("✓ Successfully prepared .next/standalone assets for Electron packaging (all symlinks resolved).");
}

main().catch((err) => {
  console.error("Failed to copy standalone assets:", err);
  process.exit(1);
});
