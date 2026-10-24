import { describe, expect, it } from 'vitest';
import { diffJson } from '../json-diff';

describe('diffJson', () => {
  it('renders nested and array paths', () => {
    const changes = diffJson(
      { choices: [{ delta: { content: 'a' } }], done: false },
      { choices: [{ delta: { content: 'b', role: 'x' } }], usage: 1 },
    );
    expect(changes).toEqual(
      expect.arrayContaining([
        { type: 'CHANGE', path: 'choices[0].delta.content', from: 'a', to: 'b' },
        { type: 'CREATE', path: 'choices[0].delta.role', to: 'x' },
        { type: 'REMOVE', path: 'done', from: false },
        { type: 'CREATE', path: 'usage', to: 1 },
      ]),
    );
  });
  it('handles root primitives', () => {
    expect(diffJson('a', 'b')).toEqual([{ type: 'CHANGE', path: '$', from: 'a', to: 'b' }]);
    expect(diffJson(1, 1)).toEqual([]);
  });
});
