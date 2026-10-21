import { cp, mkdir, rm } from "node:fs/promises";
// Update tests mutate their own worker, never the dist served to a real user.
await mkdir("tmp", { recursive: true });
await rm("tmp/pages-preview", { recursive: true, force: true });
await cp("dist", "tmp/pages-preview", { recursive: true });
