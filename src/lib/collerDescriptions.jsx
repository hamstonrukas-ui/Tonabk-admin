// Lit une liste "fichier | titre | description | type | sous-catégorie" (type et sous-catégorie facultatifs).
const TYPES_OK = ["habit", "pantalon", "soulier", "autre"];
const base = (nom) => String(nom || "").trim().toLowerCase().replace(/\.[a-z0-9]{2,5}$/, "");

export function lireLignes(texte) {
  const lignes = [];
  for (const brute of String(texte || "").split(/\r?\n/)) {
    const l = brute.trim().replace(/^[-*\d.)\s]+(?=\S+\.(jpe?g|png|webp|gif)\b)/i, "");
    if (!l || !l.includes("|")) continue;
    const p = l.split("|").map((x) => x.trim());
    if (p.length < 3 || !p[0] || !p[1]) continue;
    if (/^nom[_ ]?du[_ ]?fichier$/i.test(p[0]) || /^fichier$/i.test(p[0])) continue; // ligne d'en-tête
    const type = TYPES_OK.includes((p[3] || "").toLowerCase()) ? p[3].toLowerCase() : "autre";
    lignes.push({ cle: base(p[0]), titre: p[1].slice(0, 80), description: p[2].slice(0, 500), type, sousCat: (p[4] || "").toLowerCase() });
  }
  return lignes;
}

// Associe chaque ligne à une photo (par nom de fichier). Retourne { maj: Map(cleItem -> champs), sansPhoto: [...] }
export function associer(lignes, items, sousCats = {}) {
  const parNom = new Map();
  items.forEach((i) => { if (i.etat === "attente" || i.etat === "erreur-ia") parNom.set(base(i.fichier?.name), i); });
  const idParNom = Object.fromEntries(Object.entries(sousCats).map(([id, nom]) => [String(nom).toLowerCase(), id]));
  const maj = new Map();
  const sansPhoto = [];
  for (const l of lignes) {
    const it = parNom.get(l.cle);
    if (!it) { sansPhoto.push(l.cle); continue; }
    maj.set(it.cle, { titre: l.titre, description: l.description, type: l.type, sous_categorie_id: idParNom[l.sousCat] || null });
  }
  return { maj, sansPhoto };
}
