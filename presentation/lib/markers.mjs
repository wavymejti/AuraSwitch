// Time markers for the montage, on the same clock as CDP screencast frame timestamps.
import fs from "node:fs";

export const createMarkers = (file) => {
  const list = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
  const mark = (name, extra = {}) => {
    const entry = { name, t: Date.now() / 1000, ...extra };
    list.push(entry);
    fs.writeFileSync(file, JSON.stringify(list, null, 2));
    console.log(`  ▸ ${name}`);
    return entry;
  };
  return { mark, list };
};
