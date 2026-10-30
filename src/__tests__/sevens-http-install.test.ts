// SEVENS: the HTTP channel's install_skill writes no skill either (FORK.md). Adapted from Codex's review repro.
import { it, expect, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { reportAndSyncLocalAgent } from '../local-agent.js';

it('refuses an HTTP install_skill and writes no tool skill', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'teamai-sevens-http-'));
  vi.stubEnv('HOME', home); vi.stubEnv('USERPROFILE', home);
  try {
    await fs.mkdir(path.join(home, '.codebuddy', 'skills'), { recursive: true });
    await fs.mkdir(path.join(home, '.teamai', 'local-agent'), { recursive: true });
    await fs.writeFile(path.join(home, '.teamai', 'local-agent', 'config.json'), JSON.stringify({ endpoint: 'https://test.example.com/api', token: 'fixture', localAgentId: 'fixture', createdAt: '2026-01-01T00:00:00.000Z', workspaceBindings: {} }));
    const zip = zipSync({ 'http-skill/SKILL.md': strToU8('---\nname: http-skill\ndescription: Test\n---\nTest.\n') });
    const acks: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/skill.zip')) return new Response(Buffer.from(zip));
      if (url.includes('/local-agent/sync')) return new Response(JSON.stringify({ ok: true, commands: [{ id: 1, type: 'install_skill', skill_slug: 'http-skill', skill_version: '1.0.0', download_url: 'http://127.0.0.1:41999/skill.zip' }] }));
      if (url.includes('/commands/ack')) acks.push(JSON.parse(String(init?.body ?? '{}')));
      return new Response(JSON.stringify({ ok: true }));
    }));
    await reportAndSyncLocalAgent({ cwd: home, tool: 'codebuddy', status: 'running' });
    expect(await fs.readFile(path.join(home, '.codebuddy', 'skills', 'http-skill', 'SKILL.md'), 'utf8').catch(() => null)).toBeNull();
    expect(JSON.stringify(acks)).not.toContain('"success"');
  } finally {
    vi.unstubAllEnvs(); vi.unstubAllGlobals(); await fs.rm(home, { recursive: true, force: true });
  }
});
