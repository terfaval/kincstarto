import { join } from "node:path";
import { readJsonStore, writeJsonStore } from "./jsonStore";
import type { Anatomy, KnowledgeCard, Pose } from "./yogiKnowledgeSchema";

export type YogiCollectionKey = "poses" | "anatomy" | "knowledge_cards";

type CollectionConfig = {
  blobPath: string;
  filePath: string;
};

const BASE_DIR = join(process.cwd(), "data", "yogi");

const COLLECTIONS: Record<YogiCollectionKey, CollectionConfig> = {
  poses: {
    blobPath: "yogi/poses.json",
    filePath: join(BASE_DIR, "poses.json"),
  },
  anatomy: {
    blobPath: "yogi/anatomy.json",
    filePath: join(BASE_DIR, "anatomy.json"),
  },
  knowledge_cards: {
    blobPath: "yogi/knowledge-cards.json",
    filePath: join(BASE_DIR, "knowledge-cards.json"),
  },
};

export type YogiKnowledgeStore = {
  readCollection<T>(key: YogiCollectionKey, fallback: T[]): Promise<T[]>;
  writeCollection<T>(key: YogiCollectionKey, items: T[]): Promise<void>;
  listPoses(): Promise<Pose[]>;
  listAnatomy(): Promise<Anatomy[]>;
  listKnowledgeCards(): Promise<KnowledgeCard[]>;
  savePoses(items: Pose[]): Promise<void>;
  saveAnatomy(items: Anatomy[]): Promise<void>;
  saveKnowledgeCards(items: KnowledgeCard[]): Promise<void>;
};

function createJsonStore(): YogiKnowledgeStore {
  async function readCollection<T>(key: YogiCollectionKey, fallback: T[]): Promise<T[]> {
    const config = COLLECTIONS[key];
    const parsed = await readJsonStore<T[]>({
      blobPath: config.blobPath,
      filePath: config.filePath,
      fallbackValue: fallback,
    });
    return Array.isArray(parsed) ? parsed : fallback;
  }

  async function writeCollection<T>(key: YogiCollectionKey, items: T[]) {
    const config = COLLECTIONS[key];
    await writeJsonStore(
      {
        blobPath: config.blobPath,
        filePath: config.filePath,
      },
      items
    );
  }

  return {
    readCollection,
    writeCollection,
    listPoses: () => readCollection<Pose>("poses", []),
    listAnatomy: () => readCollection<Anatomy>("anatomy", []),
    listKnowledgeCards: () => readCollection<KnowledgeCard>("knowledge_cards", []),
    savePoses: (items) => writeCollection<Pose>("poses", items),
    saveAnatomy: (items) => writeCollection<Anatomy>("anatomy", items),
    saveKnowledgeCards: (items) => writeCollection<KnowledgeCard>("knowledge_cards", items),
  };
}

export function getYogiKnowledgeStore() {
  return createJsonStore();
}

export function createYogiId(prefix: "pose" | "anat" | "card", slug: string) {
  return `${prefix}_${slug}`;
}

export function normalizeSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "_")
    .toLowerCase();
}
