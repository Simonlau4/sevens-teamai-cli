// SEVENS: the fork leaves skills to Skill Pilot. These pin what that means on disk (FORK.md).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fse from 'fs-extra';
import { execFileSync } from 'node:child_process';

vi.mock('../config.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../config.js')>()),
  requireInit: vi.fn(),
  loadState: vi.fn().mockResolvedValue({ lastPull: null, lastPullRev: null }),
  saveState: vi.fn(),
  loadStateForScope: vi.fn(async () => ({})),
  saveStateForScope: vi.fn(),
  loadLocalConfigForScope: vi.fn(),
  loadTeamConfig: vi.fn(),
  detectProjectConfig: vi.fn().mockResolvedValue(null),
  autoDetectInit: vi.fn(),
}));
vi.mock('../utils/git.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/git.js')>()),
  pullRepo: vi.fn().mockResolvedValue('already up to date'),
  getHeadRev: vi.fn().mockResolvedValue('abc1234'),
  createGit: vi.fn(),
}));
vi.mock('../update.js', () => ({
  acquireLock: vi.fn().mockResolvedValue(true),
  releaseLock: vi.fn().mockResolvedValue(undefined),
  withFileLock: async <T>(_lock: string, _wait: unknown, body: () => Promise<T>) => ({ held: true, value: await body() }),
}));
vi.mock('../utils/logger.js', () => ({
  log: { persist: vi.fn(), info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), dim: vi.fn() },
  spinner: vi.fn(() => ({ start: vi.fn().mockReturnThis(), succeed: vi.fn().mockReturnThis(), fail: vi.fn().mockReturnThis(), warn: vi.fn().mockReturnThis(), info: vi.fn().mockReturnThis(), stop: vi.fn().mockReturnThis() })),
}));

import { checkoutRecordKey, pull } from '../pull.js';
import { push } from '../push.js';
import { deployBuiltinSkills, ownedSkillFiles } from '../builtin-skills.js';
import { buildSkillDirChecks } from '../doctor-delivery.js';
import { resolveDesiredSkills } from '../resources/desired.js';
import { contentHash } from '../resources/delivered-copies.js';
import { getHandler } from '../resources/index.js';
import { packagedSkillRoots } from '../skill-content.js';
import { syncTeamUpdatesToLocal } from '../utils/pre-push-sync.js';
import { detectProjectConfig, loadLocalConfigForScope, loadStateForScope, loadTeamConfig, saveStateForScope } from '../config.js';
import { log } from '../utils/logger.js';
import { resetWarnOnce } from '../utils/warn-once.js';
import { TeamaiConfigSchema, type LocalConfig, type State } from '../types.js';
import { SKILL_PILOT_DOCTOR_CHECK, SKILL_PILOT_PULL_HINT, SKILL_PILOT_PUSH_HINT, UPSTREAM_STUB_DIGESTS } from '../sevens.js';

const TEAM_SKILL = '---\nname: deploy\ndescription: d\n---\nDeploy.\n';

describe('SEVENS: skills are Skill Pilot\'s', () => {
  let tmp: string; let home: string; let repo: string; let skills: string; let saved: State; let config: LocalConfig;
  const teamConfig = TeamaiConfigSchema.parse({ team: 't', repo: 'https://example.invalid/x/t.git' });
  const lines = (fn: typeof log.info): string => vi.mocked(fn).mock.calls.flat().map(String).join('\n');

  beforeEach(async () => {
    tmp = await fse.mkdtemp(path.join(os.tmpdir(), 'teamai-sevens-'));
    home = path.join(tmp, 'home'); repo = path.join(tmp, 'repo'); skills = path.join(home, '.claude', 'skills');
    await fse.outputFile(path.join(repo, 'skills', 'deploy', 'SKILL.md'), TEAM_SKILL);
    await fse.ensureDir(skills);
    vi.stubEnv('HOME', home);
    vi.stubEnv('XDG_CONFIG_HOME', '');
    vi.stubEnv('CLAUDE_CONFIG_DIR', '');
    saved = {} as State;
    vi.mocked(saveStateForScope).mockImplementation(async (s) => { saved = structuredClone(s); });
    vi.mocked(loadStateForScope).mockImplementation(async () => structuredClone(saved) as never);
    vi.mocked(loadTeamConfig).mockResolvedValue(teamConfig);
    config = {
      repo: { localPath: repo, remote: 'https://example.invalid/x/t.git' }, username: 'u', updatePolicy: 'auto',
      additionalRoles: [], scope: 'user', enabledAgents: ['claude'],
    } as LocalConfig;
    vi.mocked(loadLocalConfigForScope).mockImplementation(async (scope) => scope === 'user' ? config : null);
    vi.mocked(detectProjectConfig).mockResolvedValue(null);
    resetWarnOnce();
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.mocked(log.warn).mockClear(); vi.mocked(log.info).mockClear(); vi.mocked(log.error).mockClear();
    process.exitCode = undefined;
    await fse.remove(tmp);
  });

  it('owes a member no skill, and keeps the team\'s skills in view for the sweep', async () => {
    const desired = await resolveDesiredSkills(teamConfig, config, null);
    expect(desired.kind).toBe('resolved');
    if (desired.kind !== 'resolved') return;
    expect(desired.items).toEqual([]);
    expect(desired.teamItems.map((item) => item.name)).toEqual(['deploy']);
  });

  it('delivers neither a team skill nor the teamai stub, and says where they are', async () => {
    await pull({ force: true });
    expect(await fse.readdir(skills)).toEqual([]);
    expect(lines(log.info)).toContain(SKILL_PILOT_PULL_HINT);
  });

  it('retires teamai\'s unedited copies, keeps an edited one, and leaves a link alone', async () => {
    const stub = await fse.readFile(path.join(packagedSkillRoots().deployRoot, 'teamai', 'SKILL.md'));
    // What an earlier pull delivered: the team skill as it is in the repo, and the stub.
    await fse.outputFile(path.join(skills, 'deploy', 'SKILL.md'), TEAM_SKILL);
    await fse.outputFile(path.join(skills, 'teamai', 'SKILL.md'), stub);
    await pull({ force: true });
    expect(await fse.readdir(skills)).toEqual([]);

    // An edited copy is the member's now.
    await fse.outputFile(path.join(skills, 'deploy', 'SKILL.md'), `${TEAM_SKILL}My note.\n`);
    // Skill Pilot's link stays exactly as it was.
    const store = path.join(tmp, 'skill-pilot', 'store', 'teamai');
    await fse.outputFile(path.join(store, 'SKILL.md'), stub);
    await fse.symlink(store, path.join(skills, 'teamai'));
    // So does Skill Pilot's install of a skill the team repo still holds, though its content matches.
    const handoff = path.join(tmp, 'skill-pilot', 'store', 'handoff');
    await fse.outputFile(path.join(repo, 'skills', 'handoff', 'SKILL.md'), TEAM_SKILL.replaceAll('deploy', 'handoff'));
    await fse.outputFile(path.join(handoff, 'SKILL.md'), TEAM_SKILL.replaceAll('deploy', 'handoff'));
    await fse.symlink(handoff, path.join(skills, 'handoff'));
    vi.mocked(log.warn).mockClear();
    await pull({ force: true });
    expect(await fse.readFile(path.join(skills, 'deploy', 'SKILL.md'), 'utf8')).toContain('My note.');
    expect(lines(log.warn)).toContain('Kept skill "deploy"');
    expect((await fse.lstat(path.join(skills, 'teamai'))).isSymbolicLink()).toBe(true);
    expect(await fse.readlink(path.join(skills, 'teamai'))).toBe(store);
    expect(lines(log.warn)).not.toContain(path.join(skills, 'teamai'));
    expect(await fse.readlink(path.join(skills, 'handoff'))).toBe(handoff);
    expect(await fse.readFile(path.join(handoff, 'SKILL.md'), 'utf8')).toContain('handoff');
  });

  it('keeps a teamai copy whole, SKILL.md included, once the member added a file to it', async () => {
    const stub = await fse.readFile(path.join(packagedSkillRoots().deployRoot, 'teamai', 'SKILL.md'));
    await fse.outputFile(path.join(skills, 'teamai', 'SKILL.md'), stub);
    await fse.outputFile(path.join(skills, 'teamai', 'scripts', 'mine.sh'), '#!/bin/sh\necho mine\n');
    await deployBuiltinSkills(teamConfig, config);
    expect(await fse.readFile(path.join(skills, 'teamai', 'SKILL.md'))).toEqual(stub);
    expect(await fse.pathExists(path.join(skills, 'teamai', 'scripts', 'mine.sh'))).toBe(true);
    expect(lines(log.warn)).toContain('holds files TeamAI did not put there');
  });

  it('deletes nothing in Skill Pilot\'s store when the skills root itself links there', async () => {
    const stub = await fse.readFile(path.join(packagedSkillRoots().deployRoot, 'teamai', 'SKILL.md'));
    const store = path.join(home, '.skill-pilot', 'store');
    await fse.outputFile(path.join(store, 'teamai', 'SKILL.md'), stub);
    await fse.outputFile(path.join(store, 'deploy', 'SKILL.md'), TEAM_SKILL);
    await fse.remove(skills);
    await fse.symlink(store, skills);
    await pull({ force: true });
    expect(await fse.readlink(skills)).toBe(store);
    expect(await fse.readFile(path.join(store, 'teamai', 'SKILL.md'))).toEqual(stub);
    expect(await fse.readFile(path.join(store, 'deploy', 'SKILL.md'), 'utf8')).toBe(TEAM_SKILL);
  });

  it('retires a copy the delivery record shows unedited, though the team updated its source since', async () => {
    const file = path.join(skills, 'deploy', 'SKILL.md');
    await fse.outputFile(file, TEAM_SKILL);
    await fse.outputFile(path.join(repo, 'skills', 'deploy', 'SKILL.md'), `${TEAM_SKILL}Team v2.\n`);
    saved.lastPullByWorkspace = { [(await checkoutRecordKey(config))!]: { rev: 'abc1234', targets: ['claude'], delivered: { [file]: contentHash(TEAM_SKILL) } } } as State['lastPullByWorkspace'];
    await pull({ force: true });
    expect(await fse.pathExists(path.join(skills, 'deploy'))).toBe(false);
  });

  it('knows the stubs upstream releases deployed, though the fork ships its own', async () => {
    const owned = (await ownedSkillFiles('teamai')).get('SKILL.md');
    for (const digest of UPSTREAM_STUB_DIGESTS) expect(owned?.has(digest)).toBe(true);
  });

  it('stops push --skill with the Skill Pilot pointer, before anything else runs', async () => {
    await push({ skill: path.join(skills, 'mine') });
    expect(lines(log.error)).toContain(SKILL_PILOT_PUSH_HINT);
    expect(process.exitCode).toBe(1);
  });

  it('offers no skill to push, and says where a new one goes', async () => {
    await fse.outputFile(path.join(skills, 'mine', 'SKILL.md'), '---\nname: mine\ndescription: m\n---\nMine.\n');
    expect(await getHandler('skills').scanLocalForPush(teamConfig, config)).toEqual([]);
    expect(lines(log.warn)).toContain(SKILL_PILOT_PUSH_HINT);
  });

  it('syncs no skill before a push, though the team updated one the member left alone', async () => {
    const git = (...args: string[]): string => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
    git('init', '-q'); git('config', 'user.email', 't@example.invalid'); git('config', 'user.name', 't');
    git('add', '-A'); git('commit', '-qm', 'v1');
    const base = git('rev-parse', 'HEAD');
    await fse.outputFile(path.join(repo, 'skills', 'deploy', 'SKILL.md'), `${TEAM_SKILL}Updated.\n`);
    git('commit', '-qam', 'v2');
    // The copy is the team's v1, unedited: upstream's pre-push sync would bring it to v2.
    await fse.outputFile(path.join(skills, 'deploy', 'SKILL.md'), TEAM_SKILL);
    await syncTeamUpdatesToLocal(teamConfig, config, [base]);
    expect(await fse.readFile(path.join(skills, 'deploy', 'SKILL.md'), 'utf8')).toBe(TEAM_SKILL);
  });

  it('reports skills as Skill Pilot\'s in doctor', async () => {
    const checks = await buildSkillDirChecks({ localConfig: config, teamConfig, toolPaths: teamConfig.toolPaths } as never);
    expect(checks.map((check) => check.name)).toEqual([SKILL_PILOT_DOCTOR_CHECK]);
    expect(await checks[0]!.check()).toBe(true);
  });
});
