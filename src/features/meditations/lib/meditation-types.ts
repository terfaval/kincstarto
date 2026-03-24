export type MeditationCategory = "ALV" | "STR" | "FOK" | "ENR" | "SPC";
export type MeditationLevel = 1 | 2 | 3;
export type MeditationMode = "kontemplativ" | "imaginativ";
export type MeditationStatus = "raw" | "optimalizalt";
export type MeditationEndBehavior = "fade_out" | "soft_end" | "complete";
export type ReaderTone = "soft" | "neutral" | "deep";

export type ReaderTextBlock = {
  type: "text";
  content: string;
  tone: ReaderTone;
};

export type ReaderPauseBlock = {
  type: "pause";
  duration_ms: number;
};

export type ReaderBlock = ReaderTextBlock | ReaderPauseBlock;

export type Meditation = {
  id: string;
  title: string;
  category: MeditationCategory;
  level: MeditationLevel;
  meditation_mode: MeditationMode;
  order_in_category: number;
  duration_sec: number;
  summary_short: string;
  tone: string[];
  techniques: string[];
  visual_theme: string;
  status: MeditationStatus;
  is_published: boolean;
  campaign_key: string | null;
  source_docx: string;
  reader: {
    autoplay: true;
    end_behavior: MeditationEndBehavior;
    blocks: ReaderBlock[];
  };
};
