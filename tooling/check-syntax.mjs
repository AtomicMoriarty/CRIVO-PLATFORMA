// Valida a sintaxe do <script type="module"> embutido em app/index.html.
// (O frontend é buildless — esta é a checagem que roda no CI e antes de publicar.)
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "app/index.html"), "utf8");
const marker = '<script type="module">';
const start = html.indexOf(marker);
const end = html.indexOf("</script>", start);
if (start < 0 || end < 0) {
  console.error("❌ Bloco <script type=\"module\"> não encontrado em app/index.html");
  process.exit(1);
}
const tmp = join(root, ".module-check.mjs");
writeFileSync(tmp, html.slice(start + marker.length, end));
try {
  execSync(`node --check "${tmp}"`, { stdio: "inherit" });
  console.log("✅ Sintaxe do módulo OK");
} catch (e) {
  process.exit(1);
}
