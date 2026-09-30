// Site icons at fixed root URLs. Search engines only show a favicon whose address stays put and
// whose size is a multiple of 48px, and plenty of clients ask for /favicon.ico without reading
// the page.
import type { APIContext } from "astro";
import sharp from "sharp";
import { SITE_DESCRIPTION, SITE_NAME } from "../lib/site.mjs";
import { url } from "../lib/url";
import svg from "../../../frontend/public/favicon.svg?raw";
import appleTouchIcon from "../../../frontend/public/apple-touch-icon.png?inline";

const png = (size: number) =>
  sharp(Buffer.from(svg), { density: (72 * size) / 80 })
    .resize(size, size)
    .png()
    .toBuffer();

// An .ico is a directory of images; modern ones hold PNGs as they are.
async function ico(sizes: number[]): Promise<Buffer> {
  const images = await Promise.all(sizes.map(png));
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((image, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(sizes[i], entry);
    header.writeUInt8(sizes[i], entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += image.length;
  });
  return Buffer.concat([header, ...images]);
}

const manifest = () =>
  JSON.stringify({
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: url(),
    display: "browser",
    background_color: "#f7f7f7",
    theme_color: "#f7f7f7",
    icons: [192, 512].map((size) => ({
      src: url(`icon-${size}x${size}.png`),
      sizes: `${size}x${size}`,
      type: "image/png",
    })),
  });

const FILES: Record<string, { type: string; body: () => string | Buffer | Promise<Buffer> }> = {
  "favicon.ico": { type: "image/x-icon", body: () => ico([16, 32, 48]) },
  "favicon.svg": { type: "image/svg+xml", body: () => svg },
  "favicon-96x96.png": { type: "image/png", body: () => png(96) },
  "apple-touch-icon.png": {
    type: "image/png",
    body: () => Buffer.from(appleTouchIcon.split(",")[1], "base64"),
  },
  "icon-192x192.png": { type: "image/png", body: () => png(192) },
  "icon-512x512.png": { type: "image/png", body: () => png(512) },
  "site.webmanifest": { type: "application/manifest+json", body: manifest },
};

export const getStaticPaths = () => Object.keys(FILES).map((icon) => ({ params: { icon } }));

export async function GET({ params }: APIContext) {
  const file = FILES[params.icon!];
  const body = await file.body();
  return new Response(typeof body === "string" ? body : new Uint8Array(body), {
    headers: { "Content-Type": file.type },
  });
}
