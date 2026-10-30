// SEVENS: a teamai PR requests review from the team's reviewers, never from its own author (FORK.md).
import { describe, it, expect, vi } from 'vitest';

const { createPullRequest } = vi.hoisted(() => ({ createPullRequest: vi.fn(async (_opts: { reviewers?: string[] }) => 'https://github.com/o/r/pull/1') }));
vi.mock('../providers/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../providers/index.js')>()),
  getProvider: () => ({ name: 'github', parseRepoInput: () => ({ owner: 'o', repo: 'r' }), createPullRequest }),
}));
vi.mock('../utils/git.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/git.js')>()),
  getDefaultBranch: vi.fn(async () => 'main'),
}));

import { createPrWithFallback } from '../push.js';
import { reviewersOtherThan } from '../sevens.js';

describe('SEVENS: reviewers', () => {
  it('leaves the author out, in any letter case, and asks nobody when nobody else is listed', () => {
    expect(reviewersOtherThan(['Simonlau4', 'alice'], 'simonlau4')).toEqual(['alice']);
    expect(reviewersOtherThan(['Simonlau4'], 'Simonlau4')).toBeUndefined();
    expect(reviewersOtherThan([], 'bob')).toBeUndefined();
    expect(reviewersOtherThan(['Simonlau4'], undefined)).toEqual(['Simonlau4']);
  });

  it('requests the listed reviewers on a member\'s PR, but not the author on their own', async () => {
    const team = { repo: 'https://github.com/o/r', provider: 'github', reviewers: ['Simonlau4'] };
    const local = (username: string) => ({ repo: { remote: 'https://github.com/o/r', localPath: '/tmp/r' }, username });
    await createPrWithFallback(team, local('alice'), 'b1', 't', 'd');
    await createPrWithFallback(team, local('Simonlau4'), 'b2', 't', 'd');
    expect(createPullRequest.mock.calls.map(([opts]) => opts.reviewers)).toEqual([['Simonlau4'], undefined]);
  });
});
