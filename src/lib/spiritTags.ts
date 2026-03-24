export const TAG_OVERRIDES: Record<string, string> = {
  csuang_ce: "Csuang-ce",
  csuang_ce_ertelmezes: "Csuang-ce értelmezés",
  indiai_eposz: "Indiai eposz",
  kezdo_szemlelet: "Kezdő szemlélet",
  kezdo_tudat: "Kezdő tudat",
  kinai_klasszikus: "Kínai klasszikus",
  lao_ce: "Lao-ce",
  lin_csi: "Lin-csi",
  majomkiraly: "Majomkirály",
  mbsr: "MBSR",
  nyugati_ertelmezes: "Nyugati értelmezés",
  tao_te_king_ertelmezes: "Tao Te King értelmezés",
  taoista_gyakorlat: "Taoista gyakorlat",
  taoista_mesek: "Taoista mesék",
  taoizmus_attekintes: "Taoizmus áttekintés",
  tibeti_filoszofia: "Tibeti filozófia",
  zen_filoszofia: "Zen filozófia",
  zen_tortenet: "Zen történet",
};

export const TAG_TOKEN_LABELS: Record<string, string> = {
  allegoria: "allegória",
  bardo: "bardó",
  belso: "belső",
  feny: "fény",
  egeszseg: "egészség",
  elengedes: "elengedés",
  eletrajz: "életrajz",
  forditas: "fordítás",
  gyogyulas: "gyógyulás",
  gyujtemeny: "gyűjtemény",
  identitas: "identitás",
  intuicio: "intuíció",
  jelenlet: "jelenlét",
  kezdo: "kezdő",
  szemlelet: "szemlélet",
  kinai: "kínai",
  koan: "kóan",
  koncentracio: "koncentráció",
  mentalis: "mentális",
  trening: "tréning",
  meridian: "meridián",
  micimacko: "Micimackó",
  neurotudomany: "neurotudomány",
  ertelmezes: "értelmezés",
  radikalis: "radikális",
  reflexio: "reflexió",
  rendszerezo: "rendszerező",
  attekintes: "áttekintés",
  mesek: "mesék",
  filoszofia: "filozófia",
  tradicio: "tradíció",
  valtozas: "változás",
  vedanta: "vedánta",
  yogi: "jógi",
  tortenet: "történet",
};

export function buildTagLabel(tag: string) {
  if (TAG_OVERRIDES[tag]) return TAG_OVERRIDES[tag];
  const tokens = tag.split("_").filter(Boolean);
  if (tokens.length === 0) return tag;
  const normalized = tokens.map((token) => TAG_TOKEN_LABELS[token] ?? token);
  const label = normalized.join(" ").trim();
  if (!label) return tag;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function resolveTagLabel(tag: string, tagLabels?: Record<string, unknown>) {
  const candidate = tagLabels ? tagLabels[tag] : undefined;
  if (typeof candidate === "string" && candidate.trim().length > 0) return candidate;
  return buildTagLabel(tag);
}
