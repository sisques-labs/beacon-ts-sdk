import { describe, expect, it } from 'vitest';
import * as sdk from './index';

describe('package entry point', () => {
  it('loads', () => {
    expect(sdk).toBeDefined();
  });
});
