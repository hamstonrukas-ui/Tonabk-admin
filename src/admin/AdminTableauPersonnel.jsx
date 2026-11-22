// Tableau du personnel (admin principal) :
//  1. Gestion de l'application : chiffres automatiques
//  2. Gestion des clients : saisie manuelle, semaine par semaine (cumul dans le mois)
import { useEffect, useState } from "react";
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
const libelleMois = (mois) => new Date(`${mois}-01T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
const fmt = (n) => Number(n || 0).toLocaleString("fr-FR");

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
  const [detail, setDetail] = useState(null); // { id, nom, code, appareils }

  const charger = async (m = mois) => {
    setErreur(""); setLignes(null); setEdition(null);
    try {
      const r = await fetch(`${API_URL}/api/tableau-personnel?mois=${m}`, { headers: await entetes() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erreur");
      setLignes(d.personnel);
    } catch (e) { setErreur(e.message || "Chargement impossible"); }
  };
  useEffect(() => { charger(mois); }, [mois]);

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
    const lien = `tonabk.com/${code}`;
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
                <th style={{ ...th, textAlign: "center" }}>Téléphones différents</th><th style={{ ...th, textAlign: "center" }}>Apps installées</th>
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
                        {z.code ? <><b style={{ color: ORANGE }}>tonabk.com/{z.code}</b>{" "}
                          <button onClick={() => copier(z.code)} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 12 }}>Copier</button></> : <span style={{ color: "#999" }}>—</span>}
                        {z.code && <>{" "}<button onClick={() => voirAppareils(l)} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 12 }}>Téléphones</button></>}
                        {complet && <>{" "}<button onClick={() => creerAdresse(l)} style={{ border: `1px solid ${ORANGE}`, background: "#fff", color: ORANGE, borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 12 }}>{z.code ? "Changer" : "Créer l'adresse"}</button></>}
                      </td>
                      <td style={nombre}>{fmt(z.visiteurs)}</td><td style={nombre}>{fmt(z.installations)}</td>
                      <td style={nombre}>{fmt(z.whatsapp)}</td><td style={nombre}>{fmt(z.livraisons)}</td><td style={nombre}>{fmt(z.colis)}</td>
                    </tr>
                  );
                })}
                <tr style={{ background: "#FFF6EE" }}>
                  <td style={{ ...td, fontWeight: 800 }}>Total</td><td style={td}></td>
                  {["visiteurs", "installations", "whatsapp", "livraisons", "colis"].map((k) => (
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
        </>
      )}
    </div>
  );
}
