import { z } from "zod";

import { flavorIds, type FlavorId } from "./flavors";
import { teaCardMandalaKeys } from "./teaCardMandala";
export { flavorIds, flavorNames, flavorColors } from "./flavors";
export type { FlavorId } from "./flavors";
const id = z.string().regex(/^[a-z][a-z0-9_-]{2,63}$/);
const text = z.string().trim().min(1).max(4000);
const status = z.enum(["draft", "review", "approved"]);
const flavor = z.enum(flavorIds);
const taste = z.strictObject(Object.fromEntries(flavorIds.map(k => [k, z.number().int().min(0).max(3)])) as Record<FlavorId, z.ZodNumber>);
const teaCardVisual = z.strictObject({
  mandalaKey: z.enum(teaCardMandalaKeys).optional(),
  focusX: z.number().min(0).max(1).optional(),
  focusY: z.number().min(0).max(1).optional(),
  scale: z.number().positive().max(4).optional(),
  rotationDeg: z.number().min(-180).max(180).optional(),
});
const metadata = { id, revision: z.number().int().positive(), editorialStatus: status, sourceRefs: z.array(z.string().url().max(500)).max(30).default([]), requiresExpertReview: z.boolean().default(false) };
export const Ingredient = z.strictObject({
  ...metadata, name: text, aliases: z.array(text).max(20).default([]), botanicalName: text.nullable().default(null),
  identityVerified: z.boolean(), summary: text, primaryFlavor: flavor, tasteProfile: taste,
  cautions: z.array(text).max(30).default([]), publicProfile: z.boolean().default(false),
  // Optional calibrated, level measuring teaspoon (5 ml). No global g-to-spoon assumption.
  spoonMeasure: z.strictObject({
    gramsPerLevelTeaspoon: z.number().finite().positive().max(30),
    evidenceUrl: z.string().url().max(500),
  }).optional(),
});
export const Method = z.strictObject({
  ...metadata, title: text, description: text, equipment: z.array(text).max(30),
  riskClass: z.enum(["standard", "specialist"]),
  operations: z.array(z.discriminatedUnion("type", [
    z.strictObject({type:z.literal("manual"), title:text}),
    z.strictObject({type:z.literal("timer"), title:text, durationSeconds:z.number().int().min(1).max(2592000)}),
  ])).min(1).max(30),
});
export const Tea = z.strictObject({
  ...metadata, title: text, cardLine: text.max(200), modalDescription: text,
  ingredients: z.array(z.strictObject({ingredientId:id, sharePct:z.number().positive().max(100)})).min(1).max(40),
  tasteProfile: taste, preparationIds: z.array(id).min(1).max(20),
  visual: teaCardVisual.optional(),
});
export const Profile = z.strictObject({
  ...metadata, teaId:id, methodId:id, baseVolumeMl:z.number().int().min(25).max(10000),
  leafGrams:z.number().positive().max(1000), temperatureC:z.number().min(0).max(100).nullable(),
  steps:z.array(z.discriminatedUnion("type", [
    z.strictObject({type:z.literal("manual"), title:text}),
    z.strictObject({type:z.literal("timer"), title:text, durationSeconds:z.number().int().min(1).max(2592000)}),
  ])).min(1).max(30),
  servingNotes:z.string().max(3000).default(""),
});
export const recordSchemas = {ingredients:Ingredient, methods:Method, teas:Tea, preparationProfiles:Profile};
export type Kind = keyof typeof recordSchemas;
export const kinds: Kind[] = ["ingredients", "methods", "teas", "preparationProfiles"];
export type IngredientRecord = z.infer<typeof Ingredient>;
export type MethodRecord = z.infer<typeof Method>;
export type TeaRecord = z.infer<typeof Tea>;
export type ProfileRecord = z.infer<typeof Profile>;
export type CatalogGroups = {
  ingredients: IngredientRecord[]; methods: MethodRecord[]; teas: TeaRecord[]; preparationProfiles: ProfileRecord[];
};
export const Groups = z.strictObject({
  ingredients:z.array(Ingredient).max(2000), methods:z.array(Method).max(500),
  teas:z.array(Tea).max(2000), preparationProfiles:z.array(Profile).max(4000),
});
const release = z.strictObject({id:id, at:z.string().datetime(), backupPath:z.string().regex(/^kaori\/backups\/[a-f0-9]{32}\.json$/), previousSha:z.string().regex(/^[a-f0-9]{64}$/), nextSha:z.string().regex(/^[a-f0-9]{64}$/), counts:z.record(z.string(),z.number().int().nonnegative())});
export const Catalog = z.strictObject({format:z.literal("kaori.catalog.v1"), editorial:Groups, published:Groups, releases:z.array(release).max(100)});
export type KaoriCatalog = z.infer<typeof Catalog>;
export const EMPTY_CATALOG: KaoriCatalog = {format:"kaori.catalog.v1",editorial:{ingredients:[],methods:[],teas:[],preparationProfiles:[]},published:{ingredients:[],methods:[],teas:[],preparationProfiles:[]},releases:[]};

const createEntry = <T extends z.ZodType>(schema:T) => z.strictObject({op:z.literal("create"),id,record:schema});
const patchEntry = () => z.strictObject({
  op:z.literal("patch"),id,expectedRevision:z.number().int().positive(),
  set:z.record(z.string(),z.unknown()), clear:z.array(z.string()).max(15).optional(),
});
export const Result = z.strictObject({
  format:z.literal("kaori.result.v1"),baseSha:z.string().regex(/^[a-f0-9]{64}$/),
  changes:z.strictObject({
    ingredients:z.array(z.union([createEntry(Ingredient),patchEntry()])).max(1000),
    methods:z.array(z.union([createEntry(Method),patchEntry()])).max(300),
    teas:z.array(z.union([createEntry(Tea),patchEntry()])).max(1000),
    preparationProfiles:z.array(z.union([createEntry(Profile),patchEntry()])).max(2000),
  }),publicationIntent:z.enum(["save_draft","publish_eligible"]),editorialNotes:z.array(z.string().max(1000)).max(50).default([]),
});
export type KaoriResult = z.infer<typeof Result>;
export type PublicCatalog = CatalogGroups;

export { validateLinks } from "./guards";
