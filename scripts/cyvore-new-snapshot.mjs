// The Cyvore new website's /b/ hero, held on its first screen, as files the portfolio serves at /cyvore-new/site/
// (spec docs/superpowers/specs/2026-11-25-cyvore-new-website-teaser-design.md §3). Always from a named commit of the
// Cyvore repo's public/b (what Vercel serves), never its working folder, so a push there never changes the portfolio.
// Run by hand when the hero is somewhere Liam is happy with:
//   node scripts/cyvore-new-snapshot.mjs [ref=HEAD]        (CYVORE_REPO: the repo, default below)
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { SNAPSHOT_KEEP, heroOnly } from "../src/lib/cyvore-new/hero-only.ts";

const REPO = process.env.CYVORE_REPO ?? join(homedir(), "Documents/Case studies assets/Cyvore Website");
const OUT = "public/cyvore-new/site";
const ref = process.argv[2] ?? "HEAD";
const git = (...args) => execFileSync("git", ["-C", REPO, ...args], { encoding: "utf8" }).trim();

let commit;
try {
  commit = git("rev-parse", "--verify", "--quiet", `${ref}^{commit}`);
} catch {
  console.error(`not a commit in ${REPO}: ${ref}`);
  process.exit(1);
}
const subject = git("log", "-1", "--format=%s", commit);
const date = git("log", "-1", "--format=%cI", commit);

const tmp = mkdtempSync(join(tmpdir(), "cyvore-new-"));
try {
  const tar = join(tmp, "b.tar");
  git("archive", "--format=tar", "-o", tar, commit, "public/b", ":(exclude)public/b/scene");
  const raw = join(tmp, "raw");
  mkdirSync(raw);
  execFileSync("tar", ["-x", "-f", tar, "-C", raw]);
  const src = join(raw, "public/b");
  if (!existsSync(join(src, "index.html"))) throw new Error(`no public/b/index.html at ${commit}`);

  const next = join(tmp, "site");
  const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
  let bytes = 0, files = 0;
  for (const file of walk(src)) {
    const p = relative(src, file);
    if (!SNAPSHOT_KEEP.some((r) => r.test(p))) continue;
    const to = join(next, p);
    mkdirSync(dirname(to), { recursive: true });
    if (p === "index.html") writeFileSync(to, heroOnly(readFileSync(file, "utf8")));
    else cpSync(file, to);
    bytes += statSync(to).size;
    files++;
  }
  writeFileSync(join(next, "SNAPSHOT.json"), JSON.stringify({ repo: "Liamhasson/cyvore", path: "public/b", commit, subject, date }, null, 2) + "\n");

  // only now replace the old snapshot: a failure above leaves it as it was
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(dirname(OUT), { recursive: true });
  renameSync(next, OUT);
  console.log(`snapshot of ${commit.slice(0, 7)} "${subject}" (${date}): ${files} files, ${(bytes / 1e6).toFixed(1)} MB -> ${OUT}`);
} catch (e) {
  console.error(String(e.message ?? e));
  process.exitCode = 1;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
