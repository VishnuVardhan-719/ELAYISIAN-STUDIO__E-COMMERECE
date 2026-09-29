import { mkdir, writeFile } from "node:fs/promises";
const images = {
  hero: "photo-1578749556568-bc2c40e68b61",
  ceramics: "photo-1490312278390-ab64016e0aa9",
  vase: "photo-1578500494198-246f612d3b3d",
  bowls: "photo-1610701596007-11502861dcfa",
  textile: "photo-1600210492486-724fe5c67fb0",
  art: "photo-1579783902614-a3fb3927b6a5",
  jewellery: "photo-1535632066927-ab7c9ab60908",
  basket: "photo-1603006905003-be475563bc59",
  studio: "photo-1565193298357-c5b55ae4e4b6",
  creator1: "photo-1580489944761-15a19d654956",
  creator2: "photo-1534528741775-53994a69daeb",
  creator3: "photo-1500648767791-00dcc994a43e",
};
await mkdir("public/images", { recursive: true });
images.studio = "photo-1610701596007-11502861dcfa";
const results = await Promise.allSettled(
  Object.entries(images).map(async ([name, id]) => {
    const url = `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${name === "hero" ? 1600 : 800}&q=80&fm=webp`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${name}: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(`public/images/${name}.webp`, buffer);
    console.log(`${name}: ${Math.round(buffer.length / 1024)} KB`);
  }),
);
for (const result of results)
  if (result.status === "rejected") {
    console.error(result.reason);
    process.exitCode = 1;
  }
