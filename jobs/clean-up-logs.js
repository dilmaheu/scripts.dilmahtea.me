import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { globby } from "globby";

const logsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../logs"
);

const logPaths = await globby(logsDir + "/**/*.json", {
  absolute: true,
});

const oldLogsPaths = logPaths.filter((path) => {
  const createdAt = new Date(path.slice(path.lastIndexOf("/") + 1, -22));

  const currentDate = new Date();

  const ninetyDaysAgo = new Date(
    currentDate.setDate(currentDate.getDate() - 90)
  );

  return createdAt < ninetyDaysAgo;
});

await Promise.all(oldLogsPaths.map((path) => fs.unlink(path)));

console.log("Cleaned up " + oldLogsPaths.length + " logs");
