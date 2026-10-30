// SEVENS: upstream's tests pin upstream's skill delivery, so they run with the fork's switch
// off; the fork's own tests (`sevens-*.test.ts`) keep it on and pin what ships (FORK.md).
import path from 'node:path';
import { expect, vi } from 'vitest';

if (!path.basename(expect.getState().testPath ?? '').startsWith('sevens-')) {
  vi.doMock('../../sevens.js', async (importOriginal) => ({
    ...await importOriginal<typeof import('../../sevens.js')>(),
    SKILL_PILOT_MANAGES_SKILLS: false,
  }));
}
