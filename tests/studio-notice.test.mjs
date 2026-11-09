import test from 'node:test';
import assert from 'node:assert/strict';
import { savedNotice } from '../app/studio-store.js';

test('the studio save notice says when the draft is not being saved on this device', () => {
  assert.equal(savedNotice('memory'), 'Draft kept for this tab only. It is not being saved on this device.');
  assert.equal(savedNotice('indexeddb'), 'Draft saved in this browser.');
  assert.equal(savedNotice('localstorage'), 'Draft saved in this browser.');
});
