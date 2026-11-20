// Tableau du personnel (admin principal) :
//  1. Gestion de l'application : chiffres automatiques
//  2. Gestion des clients : saisie manuelle, par mois
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

  const demarrer = (l) => setEdition({ id: l.id, valeurs: Object.fromEntries(CHAMPS_CLIENTS.map(([k]) => [k, String(l.clients[k] ?? 0)])) });
  const enregistrer = async () => {
    setEnregistrement(true); setErreur("");
    try {
      const r = await fetch(`${API_URL}/api/tableau-personnel/clients/${edition.id}`, {
        method: "PUT", headers: await entetes(), body: JSON.stringify({ mois, ...edition.valeurs }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Enregistrement impossible");
      await charger(mois);
    } catch (e) { setErreur(e.message); }
    setEnregistrement(false);
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
          <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px" }}>{complet ? "À remplir par vous, pour le mois choisi. Les niveaux se saisissent en pourcentage (0 à 100)." : "Renseigné par l'administrateur principal, mois par mois."}</p>
          <div style={{ background: "#fff", borderRadius: 10, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={th}>Personnel</th>
                {CHAMPS_CLIENTS.map(([k, t, u]) => <th key={k} style={{ ...th, textAlign: "center" }}>{t}{u ? ` (${u})` : ""}</th>)}
                {complet && <th style={th}></th>}
              </tr></thead>
              <tbody>
                {lignes.map((l) => {
                  const enEdition = edition?.id === l.id;
                  return (
                    <tr key={l.id}>
                      <td style={{ ...td, fontWeight: 600 }}>{l.nom}</td>
                      {CHAMPS_CLIENTS.map(([k, , u]) => (
                        <td key={k} style={nombre}>
                          {enEdition ? (
                            <input type="number" min="0" max={u === "%" ? 100 : undefined} step={k === "chiffre_affaires" ? "0.01" : "1"} value={edition.valeurs[k]}
                              onChange={(e) => setEdition({ ...edition, valeurs: { ...edition.valeurs, [k]: e.target.value } })}
                              style={{ ...entree, width: k === "chiffre_affaires" ? 100 : 70 }} />
                          ) : (
                            <>{fmt(l.clients[k])}{u === "%" ? " %" : u === "$" ? " $" : ""}</>
                          )}
                        </td>
                      ))}
                      {complet && <td style={td}>
                        {enEdition ? (
                          <>
                            <button onClick={enregistrer} disabled={enregistrement} style={{ background: ORANGE, color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", fontWeight: 700, cursor: "pointer", marginRight: 4 }}>{enregistrement ? "…" : "Enregistrer"}</button>
                            <button onClick={() => setEdition(null)} style={{ background: "#eee", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>Annuler</button>
                          </>
                        ) : (
                          <button onClick={() => demarrer(l)} style={{ background: "#fff", border: `1px solid ${ORANGE}`, color: ORANGE, borderRadius: 6, padding: "6px 10px", fontWeight: 600, cursor: "pointer" }}>Modifier</button>
                        )}
                      </td>}
                    </tr>
                  );
                })}
                <tr style={{ background: "#FFF8F1" }}>
                  <td style={{ ...td, fontWeight: 800 }}>Total</td>
                  <td style={{ ...nombre, color: ORANGE }}>{fmt(somme((l) => l.clients.clients_acquis))}</td>
                  <td style={{ ...nombre, color: "#999" }}>—</td><td style={{ ...nombre, color: "#999" }}>—</td>
                  <td style={{ ...nombre, color: ORANGE }}>{fmt(somme((l) => l.clients.commandes_confirmees))}</td>
                  <td style={{ ...nombre, color: ORANGE }}>{fmt(somme((l) => l.clients.ventes_realisees))}</td>
                  <td style={{ ...nombre, color: ORANGE }}>{fmt(somme((l) => l.clients.chiffre_affaires))} $</td>
                  {complet && <td style={td}></td>}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
