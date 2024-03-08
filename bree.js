import * as path from "node:path";
import { fileURLToPath } from "node:url";

import Bree from "bree";

const bree = new Bree({
  root: path.join(path.dirname(fileURLToPath(import.meta.url)), "jobs"),
  jobs: [
    {
      name: "clean-up-logs",
      interval: "at 12:00 am",
    },
  ],
});

await bree.start();
