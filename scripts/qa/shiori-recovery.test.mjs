import test from 'node:test';
import assert from 'node:assert/strict';
import { makeShioriRecoveryCandidate, validateLinks } from './shiori-recovery-core.mjs';

const small = { library_version: 'v2', thematic_pills: [{ slug:'x' }], books:[{ id:'a', title:'A', author:'B', status:'folyamatban', themes:['x'], notes:'secret', related:[] }], paths:[{ id:'p', title:'P', book_ids:['a'], progress:20 }], tag_labels:{} };
const large = { library_version: 'v2', thematic_pills:[{ slug:'x' }], books:[{ id:'a', title:'A', author:'Updated', status:'befejezett', themes:['x'], related:['b'] }, { id:'b', title:'B', author:'C', status:'olvasatlan', themes:['x'] }], paths:[{ id:'p', title:'P2', book_ids:['a','b'], progress:100 }, { id:'p2', title:'New', book_ids:['b'] }], tag_labels:{ test:'Test' } };

test('preserves existing records and personal fields while adding missing catalog entries', () => {
  const { candidate, report } = makeShioriRecoveryCandidate(small, large);
  assert.equal(report.resultBooks, 2);
  assert.equal(report.resultPaths, 2);
  assert.equal(candidate.books[0].author, 'B');
  assert.equal(candidate.books[0].status, 'folyamatban');
  assert.equal(candidate.books[0].notes, 'secret');
  assert.deepEqual(candidate.books[0].related, ['b']);
  assert.deepEqual(candidate.paths[0], small.paths[0]);
  assert.equal(candidate.tag_labels.test, 'Test');
  validateLinks(candidate);
});

test('never mutates its input objects', () => {
  const before1=JSON.stringify(small), before2=JSON.stringify(large);
  makeShioriRecoveryCandidate(small, large);
  assert.equal(JSON.stringify(small), before1);
  assert.equal(JSON.stringify(large), before2);
});

test('rejects inconsistent linked records', () => {
  const broken = structuredClone(large);
  broken.books[1].related = ['does_not_exist'];
  assert.throws(() => makeShioriRecoveryCandidate(small, broken), /Missing linked book/);
});
