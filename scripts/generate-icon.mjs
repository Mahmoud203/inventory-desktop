import fs from "fs";
import path from "path";
import pngToIcoModule from "png-to-ico";

const pngToIco = pngToIcoModule.default || pngToIcoModule;

async function generate() {
  const buildDir = path.join(process.cwd(), "build");
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  const logoPath = path.join(process.cwd(), "public", "logo.png");
  const icoPath = path.join(buildDir, "icon.ico");

  console.log(`Generating ${icoPath} from ${logoPath}...`);
  const buf = await pngToIco(logoPath);
  fs.writeFileSync(icoPath, buf);
  console.log(`✓ Successfully generated ${icoPath} (${buf.length} bytes)`);
}

generate().catch((err) => {
  console.error("Failed to generate icon:", err);
  process.exit(1);
});
