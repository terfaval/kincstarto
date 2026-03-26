export type LayerStart = {
  mode: "block_index";
  index: number;
  fade_in_sec?: number;
};

export type LayerEnd =
  | {
      mode: "block_index";
      index: number;
      fade_out_sec?: number;
    }
  | {
      mode: "meditation_end";
      fade_out_sec?: number;
    };

export type AudioLayerConfig = {
  slot: "foundation" | "texture" | "nature" | "motion" | "accent";
  asset_id: string;
  gain: number;
  start?: LayerStart;
  end?: LayerEnd;
};

export type AudioMixConfig = {
  base_gain?: number;
  fade_in_sec?: number;
  fade_out_sec?: number;
  end_behavior?: "soft_end" | "fade_out" | "complete";
};

export type AudioSceneProfile = {
  category_alignment?: string;
};

export type MeditationAudioConfig = {
  scene_profile?: AudioSceneProfile;
  mix?: AudioMixConfig;
  layers: AudioLayerConfig[];
};

export type MeditationAudioMapItem = {
  audio: MeditationAudioConfig;
};

export type MeditationAudioMap = {
  version: string;
  items: Record<string, MeditationAudioMapItem>;
};
