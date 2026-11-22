import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { allowedOptions, currentCue, resolvePosition, selectMiniText, validatePrototypeScript } from '../src/features/yasuragi/lib/practice-engine.ts';

const fixture = JSON.parse(readFileSync('data/yasuragi/foldon-dolgozas-prototype.json','utf8'));
const live = JSON.parse(readFileSync('data/yogi/poses.json','utf8'));
const poses = Object.fromEntries(live.filter(p=>p.status==='active').map(p=>[p.id, {id:p.id,name:p.name_hu,imageUrl:p.mannequin_angled?.asset_ref??'',validated:p.validated}]));
const at = (sec, choices={}) => resolvePosition(fixture,sec,choices,poses);

test('fixture resolves all active referenced nodes', () => {
 assert.deepEqual(validatePrototypeScript(fixture,poses),[]);
});
test('P3 starts with correct existing pose pool', () => {
 assert.equal(at(1770).node.id,'P3');
 assert.deepEqual(at(1770).node.posePool,['pose_easy_pose','pose_staff_pose']);
});
test('all default route boundaries and final END', () => {
 const timeline=[[0,'P0'],[299.9,'P0'],[300,'P1'],[1020,'D1'],[1050,'P2A'],[1770,'P3'],[2130,'D2'],[2160,'P4A'],[2880,'P5'],[3360,'P6']];
 for (const [t,id] of timeline) assert.equal(at(t).node.id,id,`at ${t}`);
 assert.equal(at(3600).completed,true);
});
test('first branch re-joins at P3 with same global clock', () => {
 const choices={D1:'stand_move'};
 assert.equal(at(1050,choices).node.id,'P2B1');
 assert.equal(at(1470,choices).node.id,'P2B2');
 assert.equal(at(1770,choices).node.id,'P3');
});
test('second branch + nested decision; blocked side sit cannot be selected', () => {
 const choices={D2:'hips_legs',D2B:'side_sit'};
 assert.equal(at(2160,choices).node.id,'P4B');
 assert.equal(at(2520,choices).node.id,'D2B');
 assert.equal(allowedOptions(at(2520,choices).node,poses).length,1);
 assert.equal(at(2540,choices).node.id,'P4B-L');
 assert.equal(at(2880,choices).node.id,'P5');
 assert.equal(at(3600,choices).completed,true);
});
test('all four currently accessible complete routes resolve for every second', () => {
 for (const d1 of ['stay_seated','stand_move']) {
  for (const d2 of ['back_shoulders','hips_legs']) {
   const choices={D1:d1,D2:d2};
   for (let sec=0; sec<3600; sec++) {
    const position=at(sec,choices);
    assert.ok(position.node,`${d1}/${d2} at ${sec}`);
    assert.ok(position.localSec>=0 && position.localSec<position.node.durationSec,`${position.node.id}@${sec}`);
   }
   assert.equal(at(3600,choices).completed,true);
  }
 }
});
test('mini starts with T, then M, and quiet is quiet (no T loop)', () => {
 const n=at(1770).node;
 assert.equal(selectMiniText(n,0,'pose_easy_pose',8).kind,'T');
 assert.equal(selectMiniText(n,9,'pose_easy_pose',8).cueId,'P3_M_SETUP');
 assert.equal(selectMiniText(n,60,'pose_easy_pose',8).kind,'quiet');
 assert.equal(selectMiniText(n,146,'pose_staff_pose',8).cueId,'P3_M_MOVEMENT');
 assert.equal(selectMiniText(n,190,'pose_easy_pose',8).kind,'quiet');
});
test('late pose intro defers M only if still in start window', () => {
 const n=at(1770).node;
 assert.equal(selectMiniText(n,147,'pose_staff_pose',148).kind,'T');
 assert.equal(selectMiniText(n,149,'pose_staff_pose',148).cueId,'P3_M_MOVEMENT');
 assert.equal(selectMiniText(n,171,'pose_staff_pose',178).kind,'T');
 assert.equal(selectMiniText(n,178,'pose_staff_pose',178).kind,'quiet');
});
test('full M keeps original content even when mini T takes precedence', () => {
 const n=at(1770).node;
 assert.equal(currentCue(n,145,'pose_easy_pose').id,'P3_M_MOVEMENT');
 assert.equal(selectMiniText(n,145,'pose_easy_pose',155).kind,'T');
});
test('suppressed cue never reappears after user changes poses', () => {
 const n=at(1770).node;
 assert.equal(selectMiniText(n,160,'pose_staff_pose',154,new Set(['P3_M_MOVEMENT'])).kind,'quiet');
});
console.log('Yasuragi player fixture: targeted tests complete.');
