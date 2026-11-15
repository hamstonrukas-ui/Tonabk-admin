// Import assisté par l'IA : on dépose des photos, Claude juge la qualité et rédige titre + description,
// l'admin vérifie, fixe le prix, puis tout est publié dans la boutique choisie.
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";
import { reduireImage } from "../lib/image";
import { lireTailles, sauverTailles, composerDescription, TYPES } from "../lib/descriptionIA";
import TaillesIA from "./TaillesIA";

const MAX_PHOTOS = 100;      // par série (on peut en faire autant qu'on veut, l'une après l'autre)
const PARALLELE_IA = 3;      // analyses simultanées
const PARALLELE_PUB = 2;     // publications simultanées
const ORANGE = "#F5720C";

async function entetes(json = false) {
  const { data: { session } } = await supabase.auth.getSession();
  const h = { Authorization: `Bearer ${session?.access_token}` };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const alea = () => Math.floor(Math.random() * 100) + 1; // 1 à 100, jamais 0

const champ = { padding: 8, borderRadius: 6, border: "1px solid #ddd", boxSizing: "border-box", width: "100%" };
const bouton = (actif = true, plein = true) => ({
  padding: "9px 14px", borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: actif ? "pointer" : "default",
  border: `1px solid ${ORANGE}`, background: plein ? ORANGE : "#fff", color: plein ? "#fff" : ORANGE, opacity: actif ? 1 : 0.5,
});
const BADGES = {
  bonne: { t: "✅ Bonne qualité", c: "#2E7D32", f: "#E8F5E9" },
  moyenne: { t: "⚠️ À vérifier", c: "#B26A00", f: "#FFF3E0" },
  mauvaise: { t: "❌ Mauvaise photo", c: "#C62828", f: "#FDECEA" },
};

export default function AdminImportIA() {
  const [boutiques, setBoutiques] = useState([]);
  const [sousCats, setSousCats] = useState({});
  const [boutiqueId, setBoutiqueId] = useState("");
  const [contexte, setContexte] = useState("");
  const [prixDefaut, setPrixDefaut] = useState("");
  const [devise, setDevise] = useState("USD");
  const [stockMode, setStockMode] = useState("aleatoire");
  const [stockFixe, setStockFixe] = useState("10");
  const [tailles, setTailles] = useState(lireTailles);
  const [commentaire, setCommentaire] = useState("");
  const [srcNom, setSrcNom] = useState("");
  const [srcContact, setSrcContact] = useState("");
  const [items, setItems] = useState([]);
  const [filtre, setFiltre] = useState("tous");
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [publicationEnCours, setPublicationEnCours] = useState(false);
  const [message, setMessage] = useState("");
  const [erreurGlobale, setErreurGlobale] = useState("");
  const arret = useRef(false);
  const itemsRef = useRef([]);
  itemsRef.current = items;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/boutiques/admin/toutes`, { headers: await entetes() });
        if (res.ok) setBoutiques((await res.json()).filter((b) => b.statut === "actif"));
        const rs = await fetch(`${API_URL}/api/sous-categories`);
        if (rs.ok) setSousCats(Object.fromEntries((await rs.json()).map((s) => [s.id, s.nom])));
      } catch { /* la sélection de boutique restera vide */ }
    })();
    return () => { itemsRef.current.forEach((i) => URL.revokeObjectURL(i.apercu)); };
  }, []);

  const changerTailles = (t) => { setTailles(t); sauverTailles(t); };
  const taillesRef = useRef(tailles);
  taillesRef.current = tailles;

  const maj = (cle, patch) => setItems((prev) => prev.map((i) => (i.cle === cle ? { ...i, ...patch } : i)));

  const ajouterPhotos = (e) => {
    const fichiers = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    const restants = MAX_PHOTOS - items.filter((i) => i.etat !== "publie").length;
    if (restants <= 0) return setErreurGlobale(`${MAX_PHOTOS} photos maximum par série : publiez celles-ci d'abord.`);
    setErreurGlobale(fichiers.length > restants ? `Seules ${restants} photos ont été ajoutées (maximum ${MAX_PHOTOS} par série).` : "");
    setItems((prev) => [
      ...prev,
      ...fichiers.slice(0, restants).map((fichier, k) => ({
        cle: `${Date.now()}-${k}-${Math.random().toString(36).slice(2, 7)}`,
        fichier, reduit: null, apercu: URL.createObjectURL(fichier),
        etat: "attente", ia: null, titre: "", description: "", prix: prixDefaut, sous_categorie_id: null, type: "autre", tailles: "", inclure: false, erreur: "",
      })),
    ]);
  };

  const retirer = (cle) => {
    setItems((prev) => { const i = prev.find((x) => x.cle === cle); if (i) URL.revokeObjectURL(i.apercu); return prev.filter((x) => x.cle !== cle); });
  };

  // ---------- Analyse par l'IA ----------
  async function analyserUn(item) {
    maj(item.cle, { etat: "analyse", erreur: "" });
    try {
      const reduit = item.reduit || (await reduireImage(item.fichier, 1024, 0.8));
      let derniere = "";
      for (let essai = 0; essai < 4; essai++) {
        if (arret.current) { maj(item.cle, { reduit, etat: "attente" }); return; }
        try {
          const fd = new FormData();
          fd.append("photo", reduit);
          fd.append("boutique_id", boutiqueId);
          if (contexte.trim()) fd.append("contexte", contexte.trim());
          const res = await fetch(`${API_URL}/api/analyse-photo`, { method: "POST", headers: await entetes(), body: fd });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            maj(item.cle, {
              reduit, etat: "pret", ia: data, titre: data.titre, description: data.description,
              sous_categorie_id: data.sous_categorie_id, inclure: !!data.utilisable,
              type: data.type_article || "autre", tailles: taillesRef.current[data.type_article] || "",
            });
            return;
          }
          derniere = data.error || `Erreur ${res.status}`;
          if (!data.reessayer) break; // erreur définitive (clé, droits, quota...) : inutile de réessayer
        } catch {
          derniere = "Connexion au serveur impossible";
        }
        await pause(2000 * (essai + 1));
      }
      maj(item.cle, { reduit, etat: "erreur-ia", erreur: derniere });
    } catch {
      maj(item.cle, { etat: "erreur-ia", erreur: "Photo illisible" });
    }
  }

  async function lancerAnalyse() {
    if (!boutiqueId) return setErreurGlobale("Choisissez d'abord la boutique.");
    setErreurGlobale(""); setMessage("");
    arret.current = false;
    setAnalyseEnCours(true);
    const file = itemsRef.current.filter((i) => i.etat === "attente" || i.etat === "erreur-ia");
    let suivant = 0;
    await Promise.all(Array.from({ length: PARALLELE_IA }, async () => {
      while (!arret.current && suivant < file.length) await analyserUn(file[suivant++]);
    }));
    setAnalyseEnCours(false);
    const premiere = itemsRef.current.find((i) => i.etat === "erreur-ia");
    if (premiere && /ANTHROPIC|Clé|clé/.test(premiere.erreur)) setErreurGlobale(premiere.erreur);
  }

  // ---------- Publication ----------
  async function publierUn(item) {
    maj(item.cle, { etat: "publication", erreur: "" });
    try {
      const reduit = item.reduit || (await reduireImage(item.fichier));
      const fd = new FormData();
      fd.append("photo", reduit);
      fd.append("boutiqueId", boutiqueId);
      const up = await fetch(`${API_URL}/api/upload/photo`, { method: "POST", headers: await entetes(), body: fd });
      const dataUp = await up.json().catch(() => ({}));
      if (!up.ok) throw new Error(dataUp.message || dataUp.error || "Envoi de la photo impossible");

      const res = await fetch(`${API_URL}/api/produits`, {
        method: "POST", headers: await entetes(true),
        body: JSON.stringify({
          boutique_id: boutiqueId, nom: item.titre.trim(), prix: Number(item.prix), devise,
          stock: stockMode === "aleatoire" ? alea() : Math.max(1, Number(stockFixe) || 1),
          description: composerDescription({ description: item.description, type: item.type, tailles: item.tailles, commentaire }), photo_url: dataUp.url, photo_thumb_url: dataUp.url,
          sous_categorie_id: item.sous_categorie_id || undefined,
        }),
      });
      const produit = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(produit.error || "Création du produit impossible");

      if (produit.id && (srcNom.trim() || srcContact.trim())) {
        fetch(`${API_URL}/api/reperes/produit/${produit.id}`, {
          method: "PUT", headers: await entetes(true),
          body: JSON.stringify({ fournisseur_nom: srcNom, fournisseur_contact: srcContact, note: "" }),
        }).catch(() => {});
      }
      maj(item.cle, { reduit: null, etat: "publie", inclure: false });
      return null;
    } catch (err) {
      maj(item.cle, { etat: "erreur", erreur: err.message || "Échec" });
      return err.message || "";
    }
  }

  async function lancerPublication() {
    setErreurGlobale(""); setMessage("");
    const aPublier = itemsRef.current.filter((i) => i.inclure && ["pret", "erreur"].includes(i.etat));
    const invalides = aPublier.filter((i) => !i.titre.trim() || !(Number(i.prix) > 0));
    if (invalides.length) return setErreurGlobale(`${invalides.length} ligne(s) cochée(s) n'ont pas de titre ou de prix : complétez-les ou décochez-les.`);
    if (!aPublier.length) return setErreurGlobale("Rien à publier : cochez au moins une photo.");
    if (!window.confirm(`Publier ${aPublier.length} produit(s) dans cette boutique ?`)) return;

    setPublicationEnCours(true);
    let suivant = 0, stop = false, ok = 0;
    await Promise.all(Array.from({ length: PARALLELE_PUB }, async () => {
      while (!stop && suivant < aPublier.length) {
        const echec = await publierUn(aPublier[suivant++]);
        if (echec === null) ok++;
        else if (/limite|quota/i.test(echec)) { stop = true; setErreurGlobale(echec + " — arrêt de la publication. Augmentez la limite de photos de cette boutique puis relancez."); }
      }
    }));
    setPublicationEnCours(false);
    setMessage(`${ok} produit(s) publié(s).`);
  }

  // ---------- Affichage ----------
  const visibles = items.filter((i) => {
    if (i.etat === "publie") return filtre === "tous" || filtre === "publies";
    if (filtre === "bonnes") return i.ia?.qualite === "bonne";
    if (filtre === "verifier") return i.ia && i.ia.qualite !== "bonne";
    if (filtre === "publies") return false;
    return true;
  });
  const nb = {
    total: items.length,
    attente: items.filter((i) => i.etat === "attente" || i.etat === "erreur-ia").length,
    analyse: items.filter((i) => ["pret", "erreur", "publication", "publie"].includes(i.etat)).length,
    cochees: items.filter((i) => i.inclure && ["pret", "erreur"].includes(i.etat)).length,
    publies: items.filter((i) => i.etat === "publie").length,
  };
  const occupe = analyseEnCours || publicationEnCours;

  return (
    <div>
      <h1>Import assisté par IA</h1>
      <p style={{ fontSize: 13, color: "#666", maxWidth: 640 }}>
        Déposez vos photos : Claude écarte les mauvaises, rédige le titre et la description de chaque article et le classe.
        Vous fixez le prix, vérifiez, puis tout est publié dans la boutique choisie.
      </p>

      <div style={{ background: "#fff", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
        <select value={boutiqueId} onChange={(e) => setBoutiqueId(e.target.value)} style={champ} disabled={occupe}>
          <option value="">Choisir la boutique…</option>
          {boutiques.map((b) => <option key={b.id} value={b.id}>{b.nom}{b.ville ? ` (${b.ville})` : ""}</option>)}
        </select>
        <input value={contexte} onChange={(e) => setContexte(e.target.value)} maxLength={400} style={champ} disabled={occupe}
          placeholder="Contexte pour l'IA (optionnel) : ex. « robes et jupes pour femmes »" />
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" min="0" step="any" value={prixDefaut} onChange={(e) => setPrixDefaut(e.target.value)} placeholder="Prix par défaut" style={{ ...champ, flex: 1 }} />
          <select value={devise} onChange={(e) => setDevise(e.target.value)} style={{ ...champ, width: 90 }}>
            <option value="USD">USD</option>
            <option value="CDF">CDF</option>
          </select>
          <button type="button" style={bouton(items.length > 0, false)} disabled={!items.length}
            onClick={() => setItems((p) => p.map((i) => (i.etat === "publie" ? i : { ...i, prix: prixDefaut })))}>
            Appliquer à toutes
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <span>Stock :</span>
          <select value={stockMode} onChange={(e) => setStockMode(e.target.value)} style={{ ...champ, width: "auto" }}>
            <option value="aleatoire">Aléatoire (1 à 100)</option>
            <option value="fixe">Quantité fixe</option>
          </select>
          {stockMode === "fixe" && <input type="number" min="1" value={stockFixe} onChange={(e) => setStockFixe(e.target.value)} style={{ ...champ, width: 80 }} />}
        </div>
        <TaillesIA tailles={tailles} onTailles={changerTailles} commentaire={commentaire} onCommentaire={setCommentaire} desactive={occupe} />
        <details>
          <summary style={{ fontSize: 12, color: "#B25000", cursor: "pointer" }}>Repère privé : source des photos (optionnel, appliquée à tous)</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            <input value={srcNom} onChange={(e) => setSrcNom(e.target.value)} placeholder="Source / fournisseur (ex : TikTok @modeKinshasa)" style={champ} />
            <input value={srcContact} onChange={(e) => setSrcContact(e.target.value)} placeholder="Contact du fournisseur" style={champ} />
          </div>
        </details>

        <label style={{ ...bouton(!occupe, false), textAlign: "center", borderStyle: "dashed", pointerEvents: occupe ? "none" : "auto" }}>
          + Ajouter des photos (jusqu'à {MAX_PHOTOS} par série)
          <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={ajouterPhotos} />
        </label>
      </div>

      {erreurGlobale && <p style={{ color: "red", fontSize: 13 }}>{erreurGlobale}</p>}
      {message && <p style={{ color: "#2E7D32", fontSize: 13 }}>{message}</p>}

      {items.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "16px 0 8px" }}>
            {!analyseEnCours ? (
              <button onClick={lancerAnalyse} disabled={occupe || nb.attente === 0} style={bouton(!occupe && nb.attente > 0)}>
                ✨ Analyser {nb.attente} photo{nb.attente > 1 ? "s" : ""} avec l'IA
              </button>
            ) : (
              <button onClick={() => { arret.current = true; }} style={bouton(true, false)}>Arrêter l'analyse</button>
            )}
            <button onClick={lancerPublication} disabled={occupe || nb.cochees === 0} style={bouton(!occupe && nb.cochees > 0)}>
              {publicationEnCours ? "Publication…" : `Publier ${nb.cochees} produit${nb.cochees > 1 ? "s" : ""}`}
            </button>
            <span style={{ fontSize: 12, color: "#666" }}>
              {nb.analyse}/{nb.total} analysées · {nb.publies} publiées
            </span>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {[["tous", "Toutes"], ["bonnes", "Bonnes"], ["verifier", "À vérifier"], ["publies", "Publiées"]].map(([k, t]) => (
              <button key={k} onClick={() => setFiltre(k)} style={{ ...bouton(true, filtre === k), padding: "5px 10px", fontSize: 12 }}>{t}</button>
            ))}
            <button style={{ ...bouton(!occupe, false), padding: "5px 10px", fontSize: 12 }} disabled={occupe}
              onClick={() => setItems((p) => p.map((i) => (["pret", "erreur"].includes(i.etat) ? { ...i, inclure: i.ia?.qualite === "bonne" } : i)))}>
              Cocher seulement les bonnes
            </button>
            {nb.publies > 0 && (
              <button style={{ ...bouton(!occupe, false), padding: "5px 10px", fontSize: 12 }} disabled={occupe}
                onClick={() => setItems((p) => { p.filter((i) => i.etat === "publie").forEach((i) => URL.revokeObjectURL(i.apercu)); return p.filter((i) => i.etat !== "publie"); })}>
                Retirer les publiées
              </button>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
            {visibles.map((i) => {
              const badge = i.ia ? BADGES[i.ia.qualite] : null;
              const modifiable = ["pret", "erreur"].includes(i.etat);
              return (
                <div key={i.cle} style={{ background: "#fff", borderRadius: 10, padding: 10, display: "flex", gap: 10, opacity: i.etat === "publie" ? 0.55 : 1, border: i.etat === "erreur" || i.etat === "erreur-ia" ? "1px solid #C62828" : "1px solid transparent" }}>
                  <img src={i.apercu} alt="" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                    {i.etat === "attente" && <span style={{ fontSize: 12, color: "#999" }}>En attente d'analyse</span>}
                    {i.etat === "analyse" && <span style={{ fontSize: 12, color: ORANGE }}>Analyse en cours…</span>}
                    {i.etat === "publication" && <span style={{ fontSize: 12, color: ORANGE }}>Publication…</span>}
                    {i.etat === "publie" && <span style={{ fontSize: 12, color: "#2E7D32", fontWeight: 600 }}>✓ Publié : {i.titre}</span>}
                    {(i.etat === "erreur-ia" || i.etat === "erreur") && <span style={{ fontSize: 12, color: "#C62828" }}>{i.erreur}</span>}
                    {badge && modifiable && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: badge.c, background: badge.f, borderRadius: 4, padding: "2px 6px", alignSelf: "flex-start" }}>
                        {badge.t}{i.ia.probleme ? ` — ${i.ia.probleme}` : ""}
                      </span>
                    )}
                    {modifiable && (
                      <>
                        <input value={i.titre} onChange={(e) => maj(i.cle, { titre: e.target.value })} placeholder="Titre" style={{ ...champ, padding: 6 }} maxLength={80} />
                        <textarea value={i.description} onChange={(e) => maj(i.cle, { description: e.target.value })} rows={2} placeholder="Description" style={{ ...champ, padding: 6, resize: "none", fontSize: 12 }} maxLength={500} />
                        <div style={{ display: "flex", gap: 6 }}>
                          <select value={i.type} style={{ ...champ, padding: 6, width: 110, fontSize: 12 }}
                            onChange={(e) => maj(i.cle, { type: e.target.value, tailles: tailles[e.target.value] || "" })}>
                            {TYPES.map(([k, t]) => <option key={k} value={k}>{t.split(" (")[0]}</option>)}
                          </select>
                          <input value={i.tailles} onChange={(e) => maj(i.cle, { tailles: e.target.value })} placeholder="Tailles / pointures" style={{ ...champ, padding: 6, fontSize: 12 }} maxLength={120} />
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input type="number" min="0" step="any" value={i.prix} onChange={(e) => maj(i.cle, { prix: e.target.value })} placeholder="Prix" style={{ ...champ, padding: 6, width: 90 }} />
                          <span style={{ fontSize: 12 }}>{devise}</span>
                          <label style={{ marginLeft: "auto", fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
                            <input type="checkbox" checked={i.inclure} onChange={(e) => maj(i.cle, { inclure: e.target.checked })} /> Publier
                          </label>
                        </div>
                        {i.sous_categorie_id && sousCats[i.sous_categorie_id] && (
                          <span style={{ fontSize: 11, color: "#7A7A7A" }}>Classé : {sousCats[i.sous_categorie_id]}</span>
                        )}
                      </>
                    )}
                    {!occupe && i.etat !== "publie" && (
                      <button onClick={() => retirer(i.cle)} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#C62828", fontSize: 11, cursor: "pointer", padding: 0 }}>Retirer cette photo</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
