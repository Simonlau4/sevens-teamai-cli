// SEVENS: the real CLI leaves skills to Skill Pilot and keeps delivering rules (FORK.md).
import { expect, it } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { commitTeamRepo } from '../helpers/team-repo-history.js';

const cli = fileURLToPath(new URL('../../../dist/index.js', import.meta.url));
const stub = fileURLToPath(new URL('../../../skills/teamai/SKILL.md', import.meta.url));
const FIXTURE = '---\nname: fixture\ndescription: Fixture\n---\nFixture skill.\n';

it('delivers rules but no skill, retires teamai\'s copies, keeps Skill Pilot\'s link, and refuses push --skill', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teamai-sevens-'));
  try {
    const home = path.join(root, 'home');
    const seed = path.join(root, 'seed');
    const repo = path.join(home, '.teamai', 'team-repo');
    const skills = path.join(home, '.claude', 'skills');
    for (const dir of [path.join(seed, 'skills', 'fixture'), path.join(seed, 'rules'), path.dirname(repo), skills]) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(seed, 'teamai.yaml'), YAML.stringify({ team: 'sevens', repo: seed, provider: 'git', usageReport: false }));
    fs.writeFileSync(path.join(seed, 'skills', 'fixture', 'SKILL.md'), FIXTURE);
    fs.writeFileSync(path.join(seed, 'rules', 'agreements.md'), '# Agreements\n\nBe kind.\n');
    commitTeamRepo(seed);
    execFileSync('git', ['clone', '-q', seed, repo]);
    fs.writeFileSync(path.join(home, '.teamai', 'config.yaml'), YAML.stringify({ repo: { localPath: repo, remote: seed }, username: 'tester', scope: 'user', enabledAgents: ['claude'], updatePolicy: 'skip' }));
    // What upstream teamai delivered earlier, and Skill Pilot's link beside it.
    fs.mkdirSync(path.join(skills, 'fixture'));
    fs.writeFileSync(path.join(skills, 'fixture', 'SKILL.md'), FIXTURE);
    fs.mkdirSync(path.join(skills, 'teamai'));
    fs.copyFileSync(stub, path.join(skills, 'teamai', 'SKILL.md'));
    const store = path.join(root, 'skill-pilot', 'store', 'mine');
    fs.mkdirSync(store, { recursive: true });
    fs.writeFileSync(path.join(store, 'SKILL.md'), '---\nname: mine\ndescription: Mine\n---\nMine.\n');
    fs.symlinkSync(store, path.join(skills, 'mine'));

    const env = { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: path.join(home, '.claude'), FORCE_COLOR: '0' };
    const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], { cwd: home, env, encoding: 'utf8', timeout: 30_000 });

    const pull = run('pull', '--force');
    const pulled = pull.stdout + pull.stderr;
    expect(pull.status, pulled).toBe(0);
    expect(pulled).toContain('技能由 Skill Pilot 管理');
    expect(fs.readdirSync(skills)).toEqual(['mine']);
    expect(fs.readlinkSync(path.join(skills, 'mine'))).toBe(store);
    expect(fs.readFileSync(path.join(home, '.claude', 'rules', 'agreements.md'), 'utf8')).toContain('Be kind.');

    const doctor = run('doctor', '--json');
    const report = JSON.parse(doctor.stdout) as { checks: { name: string; ok: boolean }[] };
    expect(report.checks).toContainEqual(expect.objectContaining({ name: '技能由 Skill Pilot 管理', ok: true }));
    expect(report.checks.filter((check) => /skills/.test(check.name))).toEqual([]);

    const push = run('push', '--skill', path.join(skills, 'mine'));
    expect(push.status, push.stdout + push.stderr).toBe(1);
    expect(push.stdout + push.stderr).toContain('上架技能');
    expect(execFileSync('git', ['-C', seed, 'log', '--oneline'], { encoding: 'utf8' }).trim().split('\n')).toHaveLength(1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
