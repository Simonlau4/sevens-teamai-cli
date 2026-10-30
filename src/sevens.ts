import { lstat } from 'node:fs/promises';
import path from 'node:path';

// SEVENS: fork-only switch and wording. Skill Pilot distributes the team's skills, so this
// fork delivers none and pushes none (FORK.md). Every guard reads this one constant, so
// `grep -rn SKILL_PILOT_MANAGES_SKILLS src` lists each patch; the wording is Chinese for the team.
export const SKILL_PILOT_MANAGES_SKILLS = true;

/** The fork's GitHub repository: releases, install command and issues. */
export const SEVENS_REPO = 'Simonlau4/sevens-teamai-cli';

/** Installs or upgrades to the latest release: each release also carries its tarball under this fixed name. */
export const SEVENS_INSTALL_COMMAND = `npm install -g https://github.com/${SEVENS_REPO}/releases/latest/download/sevens-teamai-cli.tgz`;

/**
 * sha256 of each `skills/teamai/SKILL.md` an upstream release shipped that PACKAGED_SKILL_DIGESTS
 * lacks. Upstream knows its current stub by reading it from the package; the fork ships its own,
 * so the stubs upstream releases deployed would read as the member's and never be retired.
 * Regenerate after each upstream sync (FORK.md).
 */
export const UPSTREAM_STUB_DIGESTS: ReadonlySet<string> = new Set([
  '917433bc40d9b59cd5f209c1a5dd7c130f55ee0ff8d65a5fd685e2a5d0e1f490', // v0.28.0 – v0.28.1
]);

export const SKILL_PILOT_PULL_HINT = '技能由 Skill Pilot 管理，请在 Skill Pilot「团队」页安装或上架。';

export const SKILL_PILOT_PUSH_HINT = '技能不经 teamai push 提交到团队仓库，请在 Skill Pilot 看板「团队」→「上架技能」操作。';

export const SKILL_PILOT_DOCTOR_CHECK = '技能由 Skill Pilot 管理';

/**
 * Whether `target`, or any directory between `base` and it, is a symbolic link. A skills root
 * linked into Skill Pilot's store is as much Skill Pilot's as a linked skill: nothing reached that
 * way is deleted. Segments above `base` are not looked at (macOS's /var is itself a link).
 */
export async function reachedThroughLink(base: string, target: string): Promise<boolean> {
  let walked = base;
  for (const segment of path.relative(base, target).split(path.sep).filter(Boolean)) {
    walked = path.join(walked, segment);
    const entry = await lstat(walked).catch(() => null);
    if (!entry) return false;
    if (entry.isSymbolicLink()) return true;
  }
  return false;
}
