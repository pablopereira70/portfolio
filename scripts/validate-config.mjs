// Validates portfolio.config.json against the official schema before the
// build (wired up as the npm "prebuild" script). An invalid config fails the
// build with the schema's error messages.
import { existsSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { validateConfig } from "@openportfolios/schema";

const configUrl = new URL("../portfolio.config.json", import.meta.url);
const publicDir = fileURLToPath(new URL("../public", import.meta.url));

let parsed;
try {
  parsed = JSON.parse(readFileSync(configUrl, "utf8"));
} catch (error) {
  console.error("Could not read portfolio.config.json:");
  console.error(`${error.message}`);
  process.exit(1);
}

// @openportfolios/schema 1.0.0 caps person.social at 6 entries. This template
// renders any number of them (the row wraps), so that single error must not
// fail the build. Every other error still does. Drop this once the published
// schema lifts the cap.
function isSocialCapError({ path, message }) {
  return path === "person.social" && message.includes("Too big");
}

// ── image fields ──────────────────────────────────────────────────────────────
// @openportfolios/schema 1.0.0 types every image field as a URL, but this
// template also accepts the name of a file in public/ (see the "Imagens"
// section of DOCUMENTATION.md). Those values are checked here instead: the
// schema's URL error is dropped and the file must actually exist, so a typo
// still fails the build rather than shipping a broken image.
const IMAGE_FIELD = /^(meta\.ogImage|meta\.favicon|person\.avatar|workExperience\.\d+\.companyImage|certifications\.\d+\.certificationImage)$/;

// Mirrors isRemoteImage/publicImageFile in src/lib/portfolio-config.ts: a value
// with a scheme ("https:", "data:") or a protocol-relative one is remote,
// anything else names a file inside public/.
function publicImageFile(value) {
  if (typeof value !== "string") return null;
  const src = value.trim();
  if (!src || /^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith("//")) return null;
  return src.replace(/^(\.\/|\/)+/, "").replace(/^public\//, "");
}

// Every image field present in the config, as [path, value] pairs.
function imageFields(config) {
  const fields = [
    ["meta.ogImage", config?.meta?.ogImage],
    ["meta.favicon", config?.meta?.favicon],
    ["person.avatar", config?.person?.avatar],
  ];
  for (const [i, job] of (config?.workExperience ?? []).entries()) {
    fields.push([`workExperience.${i}.companyImage`, job?.companyImage]);
  }
  for (const [i, cert] of (config?.certifications ?? []).entries()) {
    fields.push([`certifications.${i}.certificationImage`, cert?.certificationImage]);
  }
  return fields.filter(([, value]) => value !== undefined && value !== null);
}

const localImages = imageFields(parsed)
  .map(([path, value]) => [path, publicImageFile(value)])
  .filter(([, file]) => file !== null);

const localImagePaths = new Set(localImages.map(([path]) => path));

// The schema rejects these values for not being URLs; that verdict is replaced
// by the public/ check below.
function isLocalImageError({ path }) {
  return IMAGE_FIELD.test(path) && localImagePaths.has(path);
}

const missingImages = localImages
  .filter(([, file]) => {
    const resolved = join(publicDir, file);
    return !resolved.startsWith(publicDir + sep) || !existsSync(resolved);
  })
  .map(([path, file]) => ({
    path,
    message: `${path}: file "${file}" was not found in public/. Add it there, or use a full image URL.`,
  }));

const result = validateConfig(parsed);
const schemaErrors = result.success
  ? []
  : result.errors.filter((e) => !isSocialCapError(e) && !isLocalImageError(e));
const errors = [...schemaErrors, ...missingImages];

if (errors.length) {
  console.error("Invalid portfolio.config.json:");
  for (const { path, message } of errors) {
    // Some schema messages already lead with the field path.
    console.error(message.startsWith(`${path}:`) ? `  ${message}` : `  ${path}: ${message}`);
  }
  process.exit(1);
}

console.log("portfolio.config.json is valid.");
