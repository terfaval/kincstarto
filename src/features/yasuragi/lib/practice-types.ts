/** Read-only editor fixture contract. Not the future admin import schema. */
export type EquipmentTip = { catalogKey: string; tip: string };
export type PoseVariation = {
  t: { full: string; mini: string };
  equipment?: EquipmentTip[];
};
export type PracticeCue = {
  id: string;
  atLocalSec: number;
  latestStartLocalSec: number;
  minVisibleSec: number;
  maxVisibleSec: number;
  appliesTo: string | string[];
  full: string;
  mini: string;
};
export type SegmentNode = {
  id: string;
  type: "segment";
  name: string;
  startGlobalSec: number;
  durationSec: number;
  defaultPoseId: string;
  posePool: string[];
  poseVariants: Record<string, PoseVariation>;
  cues: PracticeCue[];
  nextNodeId: string;
  availability?: string;
};
export type DecisionOption = {
  id: string;
  label: string;
  miniLabel: string;
  imagePoseId: string;
  nextNodeId: string;
  default?: boolean;
  availability?: string;
  requiresPoseIds?: string[];
};
export type DecisionNode = {
  id: string;
  type: "decision";
  name: string;
  startGlobalSec: number;
  durationSec: number;
  defaultOptionId: string;
  questionMini: string;
  fullIntro: string;
  options: DecisionOption[];
};
export type PracticeNode = SegmentNode | DecisionNode;
export type PracticeScript = {
  format: string;
  version: string;
  practiceId: string;
  durationSec: number;
  startNodeId: string;
  endNodeId: string;
  nodes: PracticeNode[];
};
export type PosePreview = {
  id: string;
  name: string;
  sanskrit: string | null;
  imageUrl: string;
  setup: string;
  modifications: string[];
  cautionAreas: string[];
  validated: boolean;
};
export type PlaybackPosition = {
  node: PracticeNode | null;
  localSec: number;
  completed: boolean;
};
