import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { isRemoteImage, portfolioConfig, publicImageFile, resolveImage } from "@/lib/portfolio-config";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const PUBLIC_DIR = path.join(process.cwd(), "public");

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
};

// The icon is drawn by satori, which fetches <img src> itself and so can't
// follow a site-relative path the way the browser does. Files in public/ are
// therefore read from disk and inlined as data URIs; remote URLs are passed
// through untouched. A name that points at nothing yields undefined and the
// icon renders as an empty circle instead of failing the whole response.
function iconSource(): string | undefined {
  const raw = portfolioConfig.meta?.favicon || portfolioConfig.person?.avatar;
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  if (isRemoteImage(raw.trim())) return resolveImage(raw);

  const file = path.join(PUBLIC_DIR, publicImageFile(raw.trim()));
  // Keeps a "../" in the config from reading outside public/.
  if (!file.startsWith(PUBLIC_DIR + path.sep) || !fs.existsSync(file)) return undefined;

  const mime = MIME_TYPES[path.extname(file).toLowerCase()];
  if (!mime) return undefined;
  return `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`;
}

export default function Icon() {
  const iconUrl = iconSource();

  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          overflow: "hidden",
          display: "flex",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {iconUrl && (
          <img
            src={iconUrl}
            width={32}
            height={32}
            style={{ objectFit: "cover" }}
            alt=""
          />
        )}
      </div>
    ),
    { ...size }
  );
}
