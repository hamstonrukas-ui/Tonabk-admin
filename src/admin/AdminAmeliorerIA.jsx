// Améliorer des produits DÉJÀ publiés : on choisit une boutique, on coche des articles,
// l'IA réécrit nom + description (+ tailles/pointures + commentaire), on vérifie, puis on applique.
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";
import { lireTailles, sauverTailles, composerDescription, sansTailles, TYPES } from "../lib/descriptionIA";
import TaillesIA from "./TaillesIA";

const MAX_PAR_SERIE = 100;
const PARALLELE_IA = 3;
const ORANGE = "#F5720C";

async function entetes(json = false) {
  const { data: { session } } = await supabase.auth.getSession();
  const h = { Authorization: `Bearer ${session?.access_token}` };
  if (json) h["Content-Type"] = "application/json";
  return h;
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const champ = { padding: 8, borderRadius: 6, border: "1px solid #ddd", boxSizing: "border-box", width: "100%" };
const bouton = (actif = true, plein = true) => ({
  padding: "9px 14px", borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: actif ? "pointer" : "default",
  border: `1px solid ${ORANGE}`, background: plein ? ORANGE : "#fff", color: plein ? "#fff" : ORANGE, opacity: actif ? 1 : 0.5,
});

export default function AdminAmeliorerIA() {
  const [boutiques, setBoutiques] = useState([]);
  const [boutiqueId, setBoutiqueId] = useState("");
  const [produits, setProduits] = useState([]);       // produits de la boutique
  const [chargement, setChargement] = useState(false);
  const [coches, setCoches] = useState(new Set());
  const [filtre, setFiltre] = useState("tous");
  const [contexte, setContexte] = useState("");
  const [optNom, setOptNom] = useState(true);
  const [optDesc, setOptDesc] = useState(true);
  const [optTailles, setOptTailles] = useState(true);
  const [tailles, setTailles] = useState(lireTailles);
  const [commentaire, setCommentaire] = useState("");
  const [res, setRes] = useState({});                 // produit_id -> { etat, ia, nom, description, type, tailles, appliquer, erreur }
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [applicationEnCours, setApplicationEnCours] = useState(false);
  const [message, setMessage] = useState("");
  const [erreurGlobale, setErreurGlobale] = useState("");
  const arret = useRef(false);
  const resRef = useRef({});
  resRef.current = res;
  const taillesRef = useRef(tailles);
  taillesRef.current = tailles;

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/boutiques/admin/toutes`, { headers: await entetes() });
        if (r.ok) setBoutiques((await r.json()).filter((b) => b.statut === "actif"));
      } catch { /* liste vide */ }
    })();
  }, []);

  const changerTailles = (t) => { setTailles(t); sauverTailles(t); };
  const majRes = (id, patch) => setRes((p) => ({ ...p, [id]: { ...(p[id] || {}), ...patch } }));

  async function chargerProduits(id) {
    setBoutiqueId(id); setProduits([]); setCoches(new Set()); setRes({}); setMessage(""); setErreurGlobale("");
    if (!id) return;
    setChargement(true);
    try {
      const r = await fetch(`${API_URL}/api/produits?boutique_id=${id}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Chargement impossible");
      setProduits(d);
    } catch (e) {
      setErreurGlobale(e.message);
    }
    setChargement(false);
  }

  const sansDescription = (p) => !p.description || p.description.trim().length < 15;
  const visibles = produits.filter((p) => {
    if (filtre === "sans") return sansDescription(p);
    if (filtre === "coches") return coches.has(p.id);
    if (filtre === "traites") return res[p.id]?.etat === "applique";
    return true;
  });

  const basculer = (id) => setCoches((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const cocherVisibles = () => setCoches(new Set(visibles.slice(0, MAX_PAR_SERIE).map((p) => p.id)));

  // ---------- Analyse ----------
  async function analyserUn(p) {
    majRes(p.id, { etat: "analyse", erreur: "" });
    let derniere = "";
    for (let essai = 0; essai < 4; essai++) {
      if (arret.current) { majRes(p.id, { etat: "attente" }); return; }
      try {
        const r = await fetch(`${API_URL}/api/analyse-photo/produit`, {
          method: "POST", headers: await entetes(true),
          body: JSON.stringify({ produit_id: p.id, contexte: contexte.trim() || undefined }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok) {
          const type = d.type_article || "autre";
          majRes(p.id, {
            etat: "pret", ia: d, nom: d.titre, description: d.description, type,
            tailles: taillesRef.current[type] || "", appliquer: !!d.utilisable,
          });
          return;
        }
        derniere = d.error || `Erreur ${r.status}`;
        if (!d.reessayer) break;
      } catch {
        derniere = "Connexion au serveur impossible";
      }
      await pause(2000 * (essai + 1));
    }
    majRes(p.id, { etat: "erreur-ia", erreur: derniere });
  }

  async function lancerAnalyse() {
    const file = produits.filter((p) => coches.has(p.id) && res[p.id]?.etat !== "applique").slice(0, MAX_PAR_SERIE);
    if (!file.length) return setErreurGlobale("Cochez d'abord des articles.");
    setErreurGlobale(""); setMessage("");
    arret.current = false;
    setAnalyseEnCours(true);
    let suivant = 0;
    await Promise.all(Array.from({ length: PARALLELE_IA }, async () => {
      while (!arret.current && suivant < file.length) await analyserUn(file[suivant++]);
    }));
    setAnalyseEnCours(false);
    const e = Object.values(resRef.current).find((x) => x.etat === "erreur-ia" && /ANTHROPIC|Clé|clé/.test(x.erreur));
    if (e) setErreurGlobale(e.erreur);
  }

  // ---------- Application ----------
  async function appliquerUn(p) {
    const r = res[p.id];
    majRes(p.id, { etat: "application", erreur: "" });
    try {
      const base = optDesc ? r.description : p.description || "";
      const description = optTailles
        ? composerDescription({ description: base, type: r.type, tailles: r.tailles, commentaire })
        : optDesc ? r.description.trim() : p.description || "";
      // PUT remplace tous ces champs : on renvoie les valeurs actuelles pour ne rien perdre
      const body = {
        nom: optNom ? r.nom.trim() : p.nom,
        prix: p.prix, devise: p.devise, stock: p.stock,
        description,
        prix_gros: p.prix_gros || null, quantite_min_gros: p.quantite_min_gros || null,
      };
      const rep = await fetch(`${API_URL}/api/produits/${p.id}`, { method: "PUT", headers: await entetes(true), body: JSON.stringify(body) });
      const d = await rep.json().catch(() => ({}));
      if (!rep.ok) throw new Error(d.error || "Mise à jour impossible");
      setProduits((prev) => prev.map((x) => (x.id === p.id ? { ...x, nom: body.nom, description } : x)));
      majRes(p.id, { etat: "applique", appliquer: false });
      return true;
    } catch (e) {
      majRes(p.id, { etat: "pret", erreur: e.message || "Échec" });
      return false;
    }
  }

  async function lancerApplication() {
    const liste = produits.filter((p) => res[p.id]?.etat === "pret" && res[p.id]?.appliquer);
    if (!liste.length) return setErreurGlobale("Rien à appliquer : cochez « Appliquer » sur au moins un article analysé.");
    if (!optNom && !optDesc && !optTailles) return setErreurGlobale("Choisissez au moins une chose à modifier (nom, description ou tailles).");
    const invalide = optNom && liste.some((p) => !res[p.id].nom?.trim());
    if (invalide) return setErreurGlobale("Un article coché n'a pas de nom.");
    if (!window.confirm(`Mettre à jour ${liste.length} produit(s) ? Les anciens noms/descriptions seront remplacés.`)) return;
    setErreurGlobale(""); setApplicationEnCours(true);
    let ok = 0;
    for (const p of liste) if (await appliquerUn(p)) ok++;
    setApplicationEnCours(false);
    setMessage(`${ok} produit(s) mis à jour${ok < liste.length ? ` — ${liste.length - ok} en échec (voir en rouge)` : ""}.`);
  }

  const occupe = analyseEnCours || applicationEnCours;
  const nbCoches = coches.size;
  const nbPrets = produits.filter((p) => res[p.id]?.etat === "pret" && res[p.id]?.appliquer).length;

  return (
    <div>
      <h1>Améliorer avec l'IA</h1>
      <p style={{ fontSize: 13, color: "#666", maxWidth: 640 }}>
        Choisissez une boutique, cochez les articles déjà en ligne : l'IA regarde la photo et propose un nouveau nom,
        une description, et ajoute les tailles (habits), numéros (pantalons) ou pointures (souliers). Le prix et le stock ne changent jamais.
      </p>

      <div style={{ background: "#fff", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
        <select value={boutiqueId} onChange={(e) => chargerProduits(e.target.value)} style={champ} disabled={occupe}>
          <option value="">Choisir la boutique…</option>
          {boutiques.map((b) => <option key={b.id} value={b.id}>{b.nom}{b.ville ? ` (${b.ville})` : ""}</option>)}
        </select>
        <input value={contexte} onChange={(e) => setContexte(e.target.value)} maxLength={400} style={champ} disabled={occupe}
          placeholder="Contexte pour l'IA (optionnel) : ex. « vêtements pour hommes »" />
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}>
          <label><input type="checkbox" checked={optNom} onChange={(e) => setOptNom(e.target.checked)} /> Modifier le nom</label>
          <label><input type="checkbox" checked={optDesc} onChange={(e) => setOptDesc(e.target.checked)} /> Modifier la description</label>
          <label><input type="checkbox" checked={optTailles} onChange={(e) => setOptTailles(e.target.checked)} /> Ajouter tailles + commentaire</label>
        </div>
        <TaillesIA tailles={tailles} onTailles={changerTailles} commentaire={commentaire} onCommentaire={setCommentaire} desactive={occupe} />
      </div>

      {erreurGlobale && <p style={{ color: "red", fontSize: 13 }}>{erreurGlobale}</p>}
      {message && <p style={{ color: "#2E7D32", fontSize: 13 }}>{message}</p>}
      {chargement && <p style={{ fontSize: 13 }}>Chargement des produits…</p>}

      {produits.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "16px 0 8px" }}>
            {!analyseEnCours ? (
              <button onClick={lancerAnalyse} disabled={occupe || nbCoches === 0} style={bouton(!occupe && nbCoches > 0)}>
                ✨ Envoyer {Math.min(nbCoches, MAX_PAR_SERIE)} article{nbCoches > 1 ? "s" : ""} à l'IA
              </button>
            ) : (
              <button onClick={() => { arret.current = true; }} style={bouton(true, false)}>Arrêter</button>
            )}
            <button onClick={lancerApplication} disabled={occupe || nbPrets === 0} style={bouton(!occupe && nbPrets > 0)}>
              {applicationEnCours ? "Mise à jour…" : `Appliquer à ${nbPrets} produit${nbPrets > 1 ? "s" : ""}`}
            </button>
            <span style={{ fontSize: 12, color: "#666" }}>{produits.length} produits · {nbCoches} cochés (max {MAX_PAR_SERIE} par envoi)</span>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {[["tous", "Tous"], ["sans", "Sans description"], ["coches", "Cochés"], ["traites", "Déjà traités"]].map(([k, t]) => (
              <button key={k} onClick={() => setFiltre(k)} style={{ ...bouton(true, filtre === k), padding: "5px 10px", fontSize: 12 }}>{t}</button>
            ))}
            <button style={{ ...bouton(!occupe, false), padding: "5px 10px", fontSize: 12 }} disabled={occupe} onClick={cocherVisibles}>
              Cocher les {Math.min(visibles.length, MAX_PAR_SERIE)} affichés
            </button>
            <button style={{ ...bouton(!occupe, false), padding: "5px 10px", fontSize: 12 }} disabled={occupe} onClick={() => setCoches(new Set())}>
              Tout décocher
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
            {visibles.map((p) => {
              const r = res[p.id] || {};
              const pret = r.etat === "pret";
              return (
                <div key={p.id} style={{ background: "#fff", borderRadius: 10, padding: 10, display: "flex", gap: 10, opacity: r.etat === "applique" ? 0.6 : 1, border: r.erreur ? "1px solid #C62828" : "1px solid transparent" }}>
                  <div style={{ flexShrink: 0 }}>
                    <img src={p.photo_thumb_url || p.photo_url} alt="" loading="lazy" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8, background: "#eee" }} />
                    {!pret && r.etat !== "applique" && (
                      <label style={{ fontSize: 11, display: "flex", gap: 4, marginTop: 4 }}>
                        <input type="checkbox" checked={coches.has(p.id)} disabled={occupe} onChange={() => basculer(p.id)} /> Choisir
                      </label>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: 12, color: "#555" }}>
                      <strong>{p.nom}</strong> · {p.prix} {p.devise}
                      {sansDescription(p) && <span style={{ color: "#B26A00" }}> · sans description</span>}
                    </div>
                    {r.etat === "analyse" && <span style={{ fontSize: 12, color: ORANGE }}>Analyse en cours…</span>}
                    {r.etat === "application" && <span style={{ fontSize: 12, color: ORANGE }}>Mise à jour…</span>}
                    {r.etat === "applique" && <span style={{ fontSize: 12, color: "#2E7D32", fontWeight: 600 }}>✓ Mis à jour</span>}
                    {r.erreur && <span style={{ fontSize: 12, color: "#C62828" }}>{r.erreur}</span>}
                    {r.etat === "erreur-ia" && <span style={{ fontSize: 11, color: "#999" }}>Reste coché : relancez l'envoi.</span>}
                    {pret && (
                      <>
                        {r.ia?.probleme && <span style={{ fontSize: 11, color: "#B26A00" }}>⚠️ {r.ia.probleme}</span>}
                        <input value={r.nom} onChange={(e) => majRes(p.id, { nom: e.target.value })} style={{ ...champ, padding: 6 }} maxLength={80} placeholder="Nouveau nom" disabled={!optNom} />
                        <textarea value={r.description} onChange={(e) => majRes(p.id, { description: e.target.value })} rows={2} style={{ ...champ, padding: 6, resize: "none", fontSize: 12 }} maxLength={500} placeholder="Nouvelle description" disabled={!optDesc} />
                        <div style={{ display: "flex", gap: 6 }}>
                          <select value={r.type} disabled={!optTailles} style={{ ...champ, padding: 6, width: 110, fontSize: 12 }}
                            onChange={(e) => majRes(p.id, { type: e.target.value, tailles: tailles[e.target.value] || "" })}>
                            {TYPES.map(([k, t]) => <option key={k} value={k}>{t.split(" (")[0]}</option>)}
                          </select>
                          <input value={r.tailles} disabled={!optTailles} onChange={(e) => majRes(p.id, { tailles: e.target.value })} placeholder="Tailles / pointures" style={{ ...champ, padding: 6, fontSize: 12 }} maxLength={120} />
                        </div>
                        <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
                          <input type="checkbox" checked={!!r.appliquer} onChange={(e) => majRes(p.id, { appliquer: e.target.checked })} /> Appliquer
                        </label>
                      </>
                    )}
                    {!pret && !r.etat && !sansDescription(p) && (
                      <span style={{ fontSize: 11, color: "#888" }}>{sansTailles(p.description).slice(0, 90)}</span>
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
