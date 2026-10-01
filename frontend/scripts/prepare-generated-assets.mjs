import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const source = process.argv[2];
if (!source)
  throw new Error("Pass the directory containing the generated PNG assets.");
const files = {
  "creator1-v2": "exec-8c8c783a-d81b-4efd-8b48-35551551f5f1.png",
  "creator2-v2": "exec-a9fafecf-db4d-4558-a376-126ddb97169c.png",
  "creator3-v2": "exec-6a9958fc-b95e-41b4-9656-18ef7a4b8a09.png",
  "hero-v2": "exec-98f15ccd-081c-433b-97cc-9d8548f4a824.png",
  "textile-v2": "exec-9214c700-cf35-479d-9dac-4b71d26a4bee.png",
  "basket-v2": "exec-73899e9a-9334-4d9d-8d29-c36113acd8c4.png",
  "art-v2": "exec-78cfd9f9-51ea-4cfe-be73-81e6cfa2828c.png",
  "jewellery-v2": "exec-5b5d504c-f803-4267-9523-e30239bee711.png",
  "studio-v2": "exec-ced0ffa9-0b5b-4ede-8efb-7baabe224c83.png",
};
const imageDirectory = new URL("../public/images/", import.meta.url);
await mkdir(imageDirectory, { recursive: true });
for (const [name, file] of Object.entries(files)) {
  const info = await sharp(path.join(source, file))
    .resize({
      width: name === "hero-v2" ? 1440 : 800,
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toFile(fileURLToPath(new URL(`${name}.webp`, imageDirectory)));
  console.log(`${name}: ${Math.round(info.size / 1024)} KB`);
}
