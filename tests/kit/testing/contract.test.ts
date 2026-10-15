import type { Hub } from '@diffenderfer-games/hub';
import { describe, expectTypeOf, it } from 'vitest';
import type { HubLike } from '../../../src/kit/core/index.ts';

describe('HubLike matches the pinned hub client', () => {
  it('the real Hub is a HubLike (a client update that changes a used signature fails the typecheck)', () => {
    expectTypeOf<Hub>().toExtend<HubLike>();
  });
});
