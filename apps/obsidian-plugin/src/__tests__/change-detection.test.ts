import { describe, expect, it } from 'vitest';

import { changeToDraft } from '../change-detection.js';

describe('changeToDraft', () => {
  it('maps create to create-note', () => {
    expect(
      changeToDraft({ kind: 'create', path: 'notes/a.md', content: 'hello' })
    ).toEqual({
      type: 'create-note',
      payload: { path: 'notes/a.md', content: 'hello' },
    });
  });

  it('maps modify to replace-content', () => {
    expect(
      changeToDraft({ kind: 'modify', path: 'notes/a.md', content: 'edited' })
    ).toEqual({
      type: 'replace-content',
      payload: { path: 'notes/a.md', content: 'edited' },
    });
  });

  it('maps rename to rename-note', () => {
    expect(
      changeToDraft({ kind: 'rename', oldPath: 'a.md', newPath: 'b.md' })
    ).toEqual({
      type: 'rename-note',
      payload: { oldPath: 'a.md', newPath: 'b.md' },
    });
  });

  it('maps delete to delete-note', () => {
    expect(changeToDraft({ kind: 'delete', path: 'a.md' })).toEqual({
      type: 'delete-note',
      payload: { path: 'a.md' },
    });
  });
});
