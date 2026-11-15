// Tailles / pointures proposées selon le type d'article, et assemblage de la description finale.
const CLE = "tonabk_tailles_ia";

export const TAILLES_DEFAUT = {
  habit: "S, M, L, XL, 2XL",
  pantalon: "30, 31, 32, 33, 34, 36",
  soulier: "38, 39, 40, 41, 42, 43, 44",
  autre: "",
};

export const TYPES = [
  ["habit", "Habits (X, M, L, 2XL…)"],
  ["pantalon", "Pantalons (31, 32, 33…)"],
  ["soulier", "Souliers (pointures)"],
  ["autre", "Autre (sans taille)"],
];

export function lireTailles() {
  try {
    return { ...TAILLES_DEFAUT, ...JSON.parse(localStorage.getItem(CLE) || "{}") };
  } catch {
    return { ...TAILLES_DEFAUT };
  }
}
export function sauverTailles(t) {
  try { localStorage.setItem(CLE, JSON.stringify(t)); } catch { /* pas grave */ }
}

// Retire d'une description une éventuelle ligne "Tailles ..." déjà ajoutée (évite les doublons à la réécriture)
export function sansTailles(texte = "") {
  return String(texte).split("\n").filter((l) => !/^\s*(tailles?|pointures?)\b.*:/i.test(l)).join("\n").trim();
}

export function composerDescription({ description = "", type = "autre", tailles = "", commentaire = "" }) {
  const parties = [sansTailles(description)];
  const t = String(tailles || "").trim();
  if (t) parties.push(`${type === "soulier" ? "Pointures disponibles" : "Tailles disponibles"} : ${t}`);
  const c = String(commentaire || "").trim();
  if (c) parties.push(c);
  return parties.filter(Boolean).join("\n\n").slice(0, 900);
}
