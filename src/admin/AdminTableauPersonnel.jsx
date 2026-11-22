// Tableau du personnel (admin principal) :
//  1. Gestion de l'application : chiffres automatiques
//  2. Gestion des clients : saisie manuelle, semaine par semaine (cumul dans le mois)
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";
import { useRole } from "./RoleContext";

const ORANGE = "#F5720C";
const th = { textAlign: "left", fontSize: 11, color: "#7A7A7A", fontWeight: 700, padding: "8px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" };
const td = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f3f3f3", whiteSpace: "nowrap" };
const nombre = { ...td, textAlign: "center", fontWeight: 700 };
const entree = { width: 70, padding: 5, borderRadius: 6, border: "1px solid #ddd", textAlign: "center", fontSize: 13 };

const CHAMPS_CLIENTS = [
  ["clients_acquis", "Clients acquis", ""],
  ["conquete_secteur", "Conquête du secteur", "%"],
  ["relance", "Niveau de relance", "%"],
  ["commandes_confirmees", "Commandes confirmées", ""],
  ["ventes_realisees", "Ventes réalisées", ""],
  ["chiffre_affaires", "Chiffre d'affaires", "$"],
];

const moisActuel = () => new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 7);
function decaler(mois, delta) {
  const [a, m] = mois.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
const lundiDe = (d = new Date(Date.now() + 2 * 3600 * 1000)) => {
  const x = new Date(d); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10);
};
const libelleSemaine = (lundi) => {
  const a = new Date(`${lundi}T12:00:00Z`), b = new Date(a); b.setUTCDate(b.getUTCDate() + 6);
  const f = (x) => x.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${f(a)} → ${f(b)}`;
};
const decalerSemaine = (lundi, n) => { const d = new Date(`${lundi}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 7 * n); return d.toISOString().slice(0, 10); };
const MESSAGE_PAIE = (
  <div style={{ background: "#FFF6EE", border: `1px solid ${ORANGE}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.5, color: "#444" }}>
    <div><b style={{ color: "#c0392b" }}>⚠ Les manques peuvent affecter votre salaire mensuel et le diminuer.</b></div>
    <div><b style={{ color: "#1e8e3e" }}>★ Les excédents sont encouragés par des primes.</b></div>
  </div>
);
const libelleMois = (mois) => new Date(`${mois}-01T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
const fmt = (n) => Number(n || 0).toLocaleString("fr-FR");

// Nombre qui monte progressivement jusqu'à sa valeur (effet « compteur »)
function Compteur({ valeur, duree = 1200 }) {
  const [v, setV] = useState(0);
  const depart = useRef(0);
  useEffect(() => {
    const de = depart.current, a = Number(valeur) || 0, t0 = performance.now();
    let raf;
    const pas = (t) => {
      const k = Math.min((t - t0) / duree, 1);
      const val = de + (a - de) * (1 - Math.pow(1 - k, 3));
      setV(val); depart.current = val;
      if (k < 1) raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [valeur]);
  return <>{Math.round(v).toLocaleString("fr-FR")}</>;
}
const NOMS_MISSIONS = { app: "Gestion de l'application", sensi: "Sensibilisation terrain", clients: "Gestion des clients" };
const POIDS_MISSIONS = { app: 10, sensi: 25, clients: 45 };

async function entetes() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" };
}

export default function AdminTableauPersonnel() {
  const complet = useRole() === "admin"; // seul l'admin principal remplit la partie clients
  const [mois, setMois] = useState(moisActuel());
  const [lignes, setLignes] = useState(null);
  const [erreur, setErreur] = useState("");
  const [edition, setEdition] = useState(null); // { id, valeurs }
  const [enregistrement, setEnregistrement] = useState(false);
  const [moi, setMoi] = useState(null);
  const [lundiRes, setLundiRes] = useState(lundiDe()); // semaine du résumé
  const [resume, setResume] = useState(null);
  const [ouvert, setOuvert] = useState(null); // carte de rémunération dépliée
  const [detail, setDetail] = useState(null); // { id, nom, code, appareils }

  const charger = async (m = mois) => {
    setErreur(""); setLignes(null); setEdition(null);
    try {
      const r = await fetch(`${API_URL}/api/tableau-personnel?mois=${m}`, { headers: await entetes() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erreur");
      setLignes(d.personnel); setMoi(d.moi);
    } catch (e) { setErreur(e.message || "Chargement impossible"); }
  };
  useEffect(() => { charger(mois); }, [mois]);
  useEffect(() => {
    let annule = false;
    setResume(null);
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/tableau-personnel/resume-semaine?semaine=${lundiRes}`, { headers: await entetes() });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Erreur");
        if (!annule) setResume(d);
      } catch (e) { if (!annule) setErreur(e.message); }
    })();
    return () => { annule = true; };
  }, [lundiRes]);

  // Saisie d'une semaine : { id, semaine, valeurs }
  const demarrer = (l, semaine = lundiDe(), source = null) => setEdition({
    id: l.id, semaine,
    valeurs: Object.fromEntries(CHAMPS_CLIENTS.map(([k]) => [k, source ? String(source[k] ?? 0) : (["conquete_secteur", "relance"].includes(k) ? String(l.clients[k] ?? 0) : "0")])),
  });
  const enregistrer = async () => {
    setEnregistrement(true); setErreur("");
    try {
      const r = await fetch(`${API_URL}/api/tableau-personnel/clients/${edition.id}`, {
        method: "PUT", headers: await entetes(), body: JSON.stringify({ semaine: edition.semaine, ...edition.valeurs }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Enregistrement impossible");
      await charger(mois);
    } catch (e) { setErreur(e.message); }
    setEnregistrement(false);
  };
  const supprimerSemaine = async (l, semaine) => {
    if (!window.confirm(`Supprimer la semaine du ${libelleSemaine(semaine)} pour ${l.nom} ?`)) return;
    try {
      const r = await fetch(`${API_URL}/api/tableau-personnel/clients/${l.id}/${semaine}`, { method: "DELETE", headers: await entetes() });
      if (!r.ok) throw new Error("Suppression impossible");
      await charger(mois);
    } catch (e) { setErreur(e.message); }
  };

  const declarer = async (l) => {
    const saisie = window.prompt(`Combien de personnes ${l.id === moi ? "avez-vous" : `${l.nom} a-t-il/elle`} sensibilisées aujourd'hui ? (redonner un nombre le même jour le corrige)`, "");
    if (saisie === null || saisie.trim() === "") return;
    setErreur("");
    try {
      const r = await fetch(`${API_URL}/api/tableau-personnel/declaration`, { method: "POST", headers: await entetes(), body: JSON.stringify({ personnes: saisie, personnelId: l.id }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Enregistrement impossible");
      await charger(mois);
    } catch (e) { setErreur(e.message); }
  };
  const niveauRenseignement = async (l) => {
    const saisie = window.prompt(`Service renseignement & livraison de ${l.nom} — niveau du mois (0 à 100 %)`, String(l.remuneration.renseignement.niveau));
    if (saisie === null || saisie.trim() === "") return;
    setErreur("");
    try {
      const r = await fetch(`${API_URL}/api/tableau-personnel/renseignement/${l.id}`, { method: "PUT", headers: await entetes(), body: JSON.stringify({ mois, niveau: saisie }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Enregistrement impossible");
      await charger(mois);
    } catch (e) { setErreur(e.message); }
  };
  const creerAdresse = async (l) => {
    const saisie = window.prompt(`Adresse de ${l.nom} (3 à 20 lettres/chiffres, sans espace). Ex : ${(l.nom || "agent").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "agent"}`, l.sensibilisation.code || "");
    if (!saisie) return;
    setErreur("");
    try {
      const r = await fetch(`${API_URL}/api/sensibilisation/agents/${l.id}`, { method: "PUT", headers: await entetes(), body: JSON.stringify({ code: saisie }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Enregistrement impossible");
      await charger(mois);
    } catch (e) { setErreur(e.message); }
  };
  const voirAppareils = async (l) => {
    if (detail?.id === l.id) return setDetail(null);
    try {
      const r = await fetch(`${API_URL}/api/sensibilisation/agents/${l.id}/appareils?mois=${mois}`, { headers: await entetes() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erreur");
      setDetail({ id: l.id, nom: l.nom, ...d });
    } catch (e) { setErreur(e.message); }
  };
  const copier = async (code) => {
    const lien = `https://www.tonabk.com/${code}`;
    try { await navigator.clipboard.writeText(lien); } catch { window.prompt("Copiez l'adresse :", lien); }
  };

  const somme = (f) => (lignes || []).reduce((s, l) => s + f(l), 0);

  return (
    <div style={{ maxWidth: 980 }}>
      <h1 style={{ marginBottom: 4 }}>Tableau du personnel</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0 20px" }}>
        <button onClick={() => setMois(decaler(mois, -1))} style={{ border: `1px solid ${ORANGE}`, background: "#fff", color: ORANGE, borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}>‹</button>
        <strong style={{ textTransform: "capitalize", minWidth: 150, textAlign: "center" }}>{libelleMois(mois)}</strong>
        <button onClick={() => setMois(decaler(mois, 1))} disabled={mois >= moisActuel()} style={{ border: `1px solid ${ORANGE}`, background: "#fff", color: ORANGE, borderRadius: 6, padding: "6px 12px", cursor: "pointer", opacity: mois >= moisActuel() ? 0.4 : 1 }}>›</button>
      </div>

      {erreur && <p style={{ color: "red", fontSize: 13 }}>{erreur}</p>}
      {!lignes && !erreur && <p style={{ fontSize: 13, color: "#888" }}>Chargement…</p>}

      {lignes && lignes.length === 0 && <p style={{ fontSize: 13, color: "#888" }}>Aucun personnel (admin secondaire) pour l'instant.</p>}

      {lignes && lignes.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, margin: "0 0 2px" }}>1. Gestion de l'application</h2>
          <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px" }}>Automatique : chaque opération d'un personnel est enregistrée ici.</p>
          <div style={{ background: "#fff", borderRadius: 10, overflowX: "auto", marginBottom: 28 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={th}>Personnel</th><th style={{ ...th, textAlign: "center" }}>Soldes publiés</th><th style={{ ...th, textAlign: "center" }}>Mali mupya publiés</th>
                <th style={{ ...th, textAlign: "center" }}>Kisakoshi publiés</th><th style={{ ...th, textAlign: "center" }}>Articles ajoutés</th>
              </tr></thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.id}>
                    <td style={{ ...td, fontWeight: 600 }}>{l.nom}</td>
                    <td style={nombre}>{fmt(l.app.solde)}</td><td style={nombre}>{fmt(l.app.mali_mupya)}</td>
                    <td style={nombre}>{fmt(l.app.kisakoshi)}</td><td style={nombre}>{fmt(l.app.article)}</td>
                  </tr>
                ))}
                <tr style={{ background: "#FFF8F1" }}>
                  <td style={{ ...td, fontWeight: 800 }}>Total</td>
                  <td style={{ ...nombre, color: ORANGE }}>{fmt(somme((l) => l.app.solde))}</td><td style={{ ...nombre, color: ORANGE }}>{fmt(somme((l) => l.app.mali_mupya))}</td>
                  <td style={{ ...nombre, color: ORANGE }}>{fmt(somme((l) => l.app.kisakoshi))}</td><td style={{ ...nombre, color: ORANGE }}>{fmt(somme((l) => l.app.article))}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 style={{ fontSize: 16, margin: "0 0 2px" }}>2. Gestion des clients</h2>
          <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px" }}>
            {complet ? "Chaque semaine, cliquez sur « + Ajouter une semaine » sous le nom du personnel : les chiffres s'additionnent dans le mois (les niveaux en % gardent la dernière semaine)." : "Renseigné chaque semaine par l'administrateur principal ; les chiffres s'additionnent dans le mois."}
          </p>
          <div style={{ background: "#fff", borderRadius: 10, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={th}>Personnel</th>
                {CHAMPS_CLIENTS.map(([k, t, u]) => <th key={k} style={{ ...th, textAlign: "center" }}>{t}{u ? ` (${u})` : ""}</th>)}
              </tr></thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.id}>
                    <td style={{ ...td, fontWeight: 600, verticalAlign: "top" }}>
                      {l.nom}
                      {complet && <div><button onClick={() => demarrer(l)} style={{ marginTop: 4, background: ORANGE, color: "#fff", border: "none", borderRadius: 6, padding: "5px 9px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>+ Ajouter une semaine</button></div>}
                    </td>
                    {CHAMPS_CLIENTS.map(([k, , u]) => (
                      <td key={k} style={nombre}>{fmt(l.clients[k])}{u === "%" ? " %" : u === "$" ? " $" : ""}</td>
                    ))}
                  </tr>
                ))}
                <tr style={{ background: "#FFF8F1" }}>
                  <td style={{ ...td, fontWeight: 800 }}>Total</td>
                  <td style={{ ...nombre, color: ORANGE }}>{fmt(somme((l) => l.clients.clients_acquis))}</td>
                  <td style={{ ...nombre, color: "#999" }}>—</td><td style={{ ...nombre, color: "#999" }}>—</td>
                  <td style={{ ...nombre, color: ORANGE }}>{fmt(somme((l) => l.clients.commandes_confirmees))}</td>
                  <td style={{ ...nombre, color: ORANGE }}>{fmt(somme((l) => l.clients.ventes_realisees))}</td>
                  <td style={{ ...nombre, color: ORANGE }}>{fmt(somme((l) => l.clients.chiffre_affaires))} $</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Formulaire de la semaine (visible sans défiler) */}
          {edition && (() => {
            const l = lignes.find((x) => x.id === edition.id);
            return (
              <div style={{ background: "#fff", border: `2px solid ${ORANGE}`, borderRadius: 10, padding: 14, marginTop: 12 }}>
                <strong style={{ fontSize: 14 }}>Semaine de {l?.nom}</strong>
                <div style={{ margin: "8px 0" }}>
                  <label style={{ fontSize: 12, color: "#666" }}>Choisir un jour de la semaine :{" "}
                    <input type="date" value={edition.semaine} onChange={(e) => e.target.value && setEdition({ ...edition, semaine: e.target.value })} style={{ ...entree, width: 150 }} />
                  </label>
                  <div style={{ fontSize: 12, color: ORANGE, fontWeight: 700, marginTop: 4 }}>Semaine du {libelleSemaine(lundiDe(new Date(`${edition.semaine}T12:00:00Z`)))}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                  {CHAMPS_CLIENTS.map(([k, t, u]) => (
                    <label key={k} style={{ fontSize: 12, color: "#666", display: "block" }}>{t}{u ? ` (${u})` : ""}
                      <input type="number" min="0" max={u === "%" ? 100 : undefined} step={k === "chiffre_affaires" ? "0.01" : "1"} value={edition.valeurs[k]}
                        onChange={(e) => setEdition({ ...edition, valeurs: { ...edition.valeurs, [k]: e.target.value } })}
                        style={{ ...entree, width: "100%", boxSizing: "border-box", marginTop: 3 }} />
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: 12 }}>
                  <button onClick={enregistrer} disabled={enregistrement} style={{ background: ORANGE, color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", fontWeight: 700, cursor: "pointer", marginRight: 6 }}>{enregistrement ? "…" : "Enregistrer cette semaine"}</button>
                  <button onClick={() => setEdition(null)} style={{ background: "#eee", border: "none", borderRadius: 6, padding: "8px 14px", cursor: "pointer" }}>Annuler</button>
                </div>
                <p style={{ fontSize: 11, color: "#888", margin: "8px 0 0" }}>Ressaisir une semaine déjà enregistrée la remplace (correction).</p>
              </div>
            );
          })()}

          {/* Historique par semaine */}
          {lignes.some((l) => l.semaines.length > 0) && (
            <div style={{ background: "#fff", borderRadius: 10, padding: 14, marginTop: 12, overflowX: "auto" }}>
              <strong style={{ fontSize: 14 }}>Semaines saisies ce mois-ci</strong>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
                <thead><tr>
                  <th style={th}>Personnel</th><th style={th}>Semaine</th>
                  {CHAMPS_CLIENTS.map(([k, t]) => <th key={k} style={{ ...th, textAlign: "center" }}>{t}</th>)}
                  {complet && <th style={th}></th>}
                </tr></thead>
                <tbody>
                  {lignes.flatMap((l) => l.semaines.map((w) => (
                    <tr key={l.id + w.semaine}>
                      <td style={{ ...td, fontWeight: 600 }}>{l.nom}</td><td style={td}>{libelleSemaine(w.semaine)}</td>
                      {CHAMPS_CLIENTS.map(([k, , u]) => <td key={k} style={nombre}>{fmt(w[k])}{u === "%" ? " %" : u === "$" ? " $" : ""}</td>)}
                      {complet && <td style={td}>
                        <button onClick={() => { demarrer(l, w.semaine, w); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ background: "#fff", border: `1px solid ${ORANGE}`, color: ORANGE, borderRadius: 6, padding: "4px 8px", cursor: "pointer", marginRight: 4 }}>Corriger</button>
                        <button onClick={() => supprimerSemaine(l, w.semaine)} style={{ background: "#fff", border: "1px solid #ddd", color: "#c0392b", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}>Suppr.</button>
                      </td>}
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          )}

          <h2 style={{ fontSize: 16, margin: "28px 0 2px" }}>3. Sensibilisation terrain</h2>
          <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px" }}>
            Chaque agent donne son adresse aux personnes rencontrées (ex : tonabk.com/<b>jean</b>). Les chiffres comptent des personnes différentes, automatiquement.
          </p>
          <div style={{ background: "#fff", borderRadius: 10, overflowX: "auto", marginBottom: 28 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={th}>Personnel</th><th style={th}>Adresse à donner</th>
                <th style={{ ...th, textAlign: "center" }}>Personnes sensibilisées</th><th style={{ ...th, textAlign: "center" }}>Téléphones différents</th><th style={{ ...th, textAlign: "center" }}>Apps installées</th>
                <th style={{ ...th, textAlign: "center" }}>Contacts WhatsApp</th><th style={{ ...th, textAlign: "center" }}>Livre-moi</th>
                <th style={{ ...th, textAlign: "center" }}>Colis déposés</th>
              </tr></thead>
              <tbody>
                {lignes.map((l) => {
                  const z = l.sensibilisation;
                  return (
                    <tr key={l.id}>
                      <td style={{ ...td, fontWeight: 600 }}>{l.nom}</td>
                      <td style={td}>
                        {z.code ? <><a href={`https://www.tonabk.com/${z.code}`} target="_blank" rel="noreferrer" style={{ color: ORANGE, fontWeight: 700 }}>tonabk.com/{z.code}</a>{" "}
                          <button onClick={() => copier(z.code)} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 12 }}>Copier</button></> : <span style={{ color: "#999" }}>—</span>}
                        {z.code && <>{" "}<button onClick={() => voirAppareils(l)} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 12 }}>Téléphones</button></>}
                        {complet && <>{" "}<button onClick={() => creerAdresse(l)} style={{ border: `1px solid ${ORANGE}`, background: "#fff", color: ORANGE, borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 12 }}>{z.code ? "Changer" : "Créer l'adresse"}</button></>}
                      </td>
                      <td style={nombre}>{fmt(z.declarees)}{(complet || l.id === moi) && <div><button onClick={() => declarer(l)} style={{ marginTop: 3, background: ORANGE, color: "#fff", border: "none", borderRadius: 6, padding: "3px 8px", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>+ Déclarer</button></div>}</td>
                      <td style={nombre}>{fmt(z.visiteurs)}</td><td style={nombre}>{fmt(z.installations)}</td>
                      <td style={nombre}>{fmt(z.whatsapp)}</td><td style={nombre}>{fmt(z.livraisons)}</td><td style={nombre}>{fmt(z.colis)}</td>
                    </tr>
                  );
                })}
                <tr style={{ background: "#FFF6EE" }}>
                  <td style={{ ...td, fontWeight: 800 }}>Total</td><td style={td}></td>
                  {["declarees", "visiteurs", "installations", "whatsapp", "livraisons", "colis"].map((k) => (
                    <td key={k} style={{ ...nombre, color: ORANGE }}>{fmt(somme((l) => l.sensibilisation[k]))}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          {detail && (
            <div style={{ background: "#fff", borderRadius: 10, padding: 14, margin: "-18px 0 28px", overflowX: "auto" }}>
              <strong style={{ fontSize: 14 }}>Téléphones vus pour {detail.nom} ({libelleMois(mois)})</strong>
              {detail.appareils.length === 0 ? <p style={{ fontSize: 13, color: "#888" }}>Aucun téléphone ce mois-ci.</p> : (
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
                  <thead><tr><th style={th}>Marque</th><th style={th}>Modèle</th><th style={th}>Écran</th><th style={{ ...th, textAlign: "center" }}>Visites</th><th style={th}>Dernière</th><th style={th}>Alerte</th></tr></thead>
                  <tbody>
                    {detail.appareils.map((a) => {
                      const suspect = Number(a.visites) > 3 || Number(a.navigateurs) > 1;
                      return (
                        <tr key={a.empreinte} style={{ background: suspect ? "#FFF1F0" : undefined }}>
                          <td style={td}>{a.marque || "?"}</td><td style={td}>{a.modele || "?"}</td><td style={td}>{a.ecran || "?"}</td>
                          <td style={nombre}>{a.visites}</td>
                          <td style={td}>{new Date(a.derniere).toLocaleString("fr-FR", { timeZone: "Africa/Lubumbashi" })}</td>
                          <td style={{ ...td, color: "#c0392b", fontWeight: 700 }}>{Number(a.navigateurs) > 1 ? "⚠ même téléphone, données effacées" : Number(a.visites) > 3 ? "⚠ revenu plusieurs fois" : ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <p style={{ fontSize: 11, color: "#888", margin: "8px 0 0" }}>Un même téléphone n'est compté qu'une seule fois, même s'il ouvre l'adresse plusieurs fois.</p>
            </div>
          )}
          <h2 style={{ fontSize: 16, margin: "0 0 2px" }}>4. Compteur de rémunération</h2>
          <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px" }}>
            Les points montent à mesure que les tâches sont faites (cible atteinte = 100 % de la mission). Le service renseignement & livraison est compté à part.
          </p>
          <div style={{ marginBottom: 10 }}>{MESSAGE_PAIE}</div>
          {[...lignes].sort((a, b) => (a.id === moi ? -1 : b.id === moi ? 1 : 0)).map((l) => {
            const r = l.remuneration;
            const mien = l.id === moi;
            return (
              <div key={l.id} style={{ background: "#fff", borderRadius: 10, padding: 14, marginBottom: 12, border: mien ? `2px solid ${ORANGE}` : "1px solid #eee" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
                  <strong>{l.nom}{mien ? " (moi)" : ""}</strong>
                  <span style={{ fontSize: 12, color: "#888" }}>maximum {fmt(r.max)} points</span>
                </div>
                <div style={{ fontSize: 34, fontWeight: 800, color: ORANGE, lineHeight: 1.2 }}><Compteur valeur={r.total} /> <span style={{ fontSize: 14, color: "#888", fontWeight: 600 }}>points · {r.pct} %</span></div>
                <div style={{ height: 8, background: "#f1f1f1", borderRadius: 4, margin: "6px 0 10px", overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(r.pct, 100)}%`, height: "100%", background: ORANGE, transition: "width 1.2s" }} />
                </div>
                {Object.entries(r.missions).map(([m, x]) => (
                  <div key={m} style={{ marginBottom: 8 }}>
                    <div onClick={() => setOuvert(ouvert === `${l.id}${m}` ? null : `${l.id}${m}`)} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, cursor: "pointer", gap: 8 }}>
                      <span>{ouvert === `${l.id}${m}` ? "▾" : "▸"} {NOMS_MISSIONS[m]} <span style={{ color: "#999" }}>({POIDS_MISSIONS[m]} %)</span></span>
                      <b>{fmt(x.points)} / {fmt(x.max)} pts{x.pct < 100 ? <span style={{ color: "#c0392b", fontWeight: 600 }}> · manque {Math.round((100 - x.pct) * 10) / 10} %</span> : <span style={{ color: "#1e8e3e", fontWeight: 600 }}> · complet</span>}{x.surplus > 0 && <span style={{ color: "#1e8e3e", fontWeight: 600 }}> · surplus +{x.surplus} %</span>}</b>
                    </div>
                    <div style={{ height: 5, background: "#f1f1f1", borderRadius: 3, marginTop: 3, overflow: "hidden" }}><div style={{ width: `${Math.min(x.pct, 100)}%`, height: "100%", background: "#1e8e3e" }} /></div>
                    {ouvert === `${l.id}${m}` && (
                      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
                        <tbody>
                          {x.details.map((d) => (
                            <tr key={d.libelle}>
                              <td style={{ ...td, whiteSpace: "normal", padding: "4px 6px" }}>{d.libelle} <span style={{ color: "#aaa" }}>({d.poids} %)</span></td>
                              <td style={{ ...td, padding: "4px 6px", textAlign: "right" }}>{fmt(d.fait)} / {fmt(d.cible)}{d.haut ? ` à ${fmt(d.haut)}` : ""}</td>
                              <td style={{ ...td, padding: "4px 6px", textAlign: "right", fontWeight: 700, color: d.ecart < 0 ? "#c0392b" : "#1e8e3e" }}>{d.ecart < 0 ? `manque ${fmt(-d.ecart)}` : d.ecart > 0 ? `surplus +${fmt(d.ecart)}` : "atteint"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
                <div style={{ borderTop: "1px dashed #ddd", paddingTop: 8, marginTop: 4, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  <span>Service renseignement &amp; livraison <span style={{ color: "#999" }}>(à côté, occasionnel)</span> : niveau {r.renseignement.niveau} %</span>
                  <span><b>+ {fmt(r.renseignement.points)} pts</b> <span style={{ color: "#999" }}>/ {fmt(r.renseignement.max)}</span>
                    {complet && <button onClick={() => niveauRenseignement(l)} style={{ marginLeft: 8, background: "#fff", border: `1px solid ${ORANGE}`, color: ORANGE, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}>Saisir</button>}
                  </span>
                </div>
              </div>
            );
          })}
          <h2 style={{ fontSize: 16, margin: "28px 0 2px" }}>5. Résumé de la semaine</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0 10px" }}>
            <button onClick={() => setLundiRes(decalerSemaine(lundiRes, -1))} style={{ border: `1px solid ${ORANGE}`, background: "#fff", color: ORANGE, borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}>‹</button>
            <strong style={{ minWidth: 170, textAlign: "center", fontSize: 14 }}>{libelleSemaine(lundiRes)}{lundiRes === lundiDe() ? " (en cours)" : ""}</strong>
            <button onClick={() => setLundiRes(decalerSemaine(lundiRes, 1))} disabled={lundiRes >= lundiDe()} style={{ border: `1px solid ${ORANGE}`, background: "#fff", color: ORANGE, borderRadius: 6, padding: "6px 12px", cursor: "pointer", opacity: lundiRes >= lundiDe() ? 0.4 : 1 }}>›</button>
          </div>
          {!resume && <p style={{ fontSize: 13, color: "#888" }}>Chargement…</p>}
          {resume && [...resume.personnel].sort((a, b) => (a.id === resume.moi ? -1 : b.id === resume.moi ? 1 : 0)).map((l) => {
            const r = l.remuneration;
            const mien = l.id === resume.moi;
            const manques = Object.values(r.missions).flatMap((x) => x.details.filter((d) => d.ecart < 0)).length;
            const excedents = Object.values(r.missions).flatMap((x) => x.details.filter((d) => d.ecart > 0)).length;
            return (
              <div key={l.id} style={{ background: "#fff", borderRadius: 10, padding: 14, marginBottom: 12, border: mien ? `2px solid ${ORANGE}` : "1px solid #eee" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                  <strong>{l.nom}{mien ? " (moi)" : ""}</strong>
                  <b style={{ color: ORANGE }}>{fmt(r.total)} / {fmt(r.max)} points · {r.pct} %</b>
                </div>
                <div style={{ fontSize: 12, margin: "4px 0 8px" }}>
                  <span style={{ color: manques ? "#c0392b" : "#1e8e3e", fontWeight: 700 }}>{manques ? `${manques} point(s) en manque` : "Aucun manque"}</span>
                  {" · "}<span style={{ color: excedents ? "#1e8e3e" : "#888", fontWeight: 700 }}>{excedents ? `${excedents} excédent(s)` : "aucun excédent"}</span>
                </div>
                {Object.entries(r.missions).map(([m, x]) => (
                  <div key={m} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: x.pct < 100 ? "#c0392b" : "#1e8e3e" }}>{NOMS_MISSIONS[m]} — {x.pct} %{x.surplus > 0 ? ` (excédent +${x.surplus} %)` : ""}</div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <tbody>
                        {x.details.map((d) => (
                          <tr key={d.libelle} style={{ background: d.ecart < 0 ? "#FFF1F0" : d.ecart > 0 ? "#EEF8F0" : undefined }}>
                            <td style={{ ...td, whiteSpace: "normal", padding: "4px 6px" }}>{d.libelle}</td>
                            <td style={{ ...td, padding: "4px 6px", textAlign: "right" }}>{fmt(d.fait)} / {fmt(d.cible)}</td>
                            <td style={{ ...td, padding: "4px 6px", textAlign: "right", fontWeight: 700, color: d.ecart < 0 ? "#c0392b" : "#1e8e3e" }}>{d.ecart < 0 ? `manque ${fmt(-d.ecart)}` : d.ecart > 0 ? `excédent +${fmt(d.ecart)}` : "atteint ✓"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            );
          })}
          {resume && MESSAGE_PAIE}
        </>
      )}
    </div>
  );
}
