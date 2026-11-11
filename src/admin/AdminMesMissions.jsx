// Page employé : voir les missions de la semaine envoyées par l'admin et indiquer où on en est.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` };
}

function lundiDe(date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function decaler(lundi, jours) {
  const d = new Date(lundi + "T12:00:00");
  d.setDate(d.getDate() + jours);
  return lundiDe(d);
}
function libelleSemaine(lundi) {
  const debut = new Date(lundi + "T12:00:00");
  const fin = new Date(lundi + "T12:00:00");
  fin.setDate(fin.getDate() + 6);
  const f = (d, opts) => d.toLocaleDateString("fr-FR", opts);
  return `Semaine du ${f(debut, { day: "numeric", month: "long" })} au ${f(fin, { day: "numeric", month: "long", year: "numeric" })}`;
}

const STATUTS = [
  { cle: "a_faire", texte: "À faire", couleur: "#7A7A7A" },
  { cle: "en_cours", texte: "En cours", couleur: "#F5720C" },
  { cle: "terminee", texte: "Terminée", couleur: "#2E7D32" },
];

export default function AdminMesMissions() {
  const [semaine, setSemaine] = useState(() => lundiDe(new Date()));
  const [missions, setMissions] = useState([]);
  const [notes, setNotes] = useState({}); // id -> retour en cours de saisie
  const [etat, setEtat] = useState({}); // id -> "en_cours" | message d'erreur
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const res = await fetch(`${API_URL}/api/missions/mes?semaine=${semaine}`, { headers: await authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(res.status === 404 ? "Les missions ne sont pas encore disponibles sur le serveur." : data.error || `Erreur ${res.status}`);
      setMissions(data.missions || []);
      setNotes({});
    } catch (err) {
      setErreur(err.message || "Impossible de contacter le serveur");
    }
    setChargement(false);
  }, [semaine]);

  useEffect(() => { charger(); }, [charger]);

  const mettreAJour = async (m, statut) => {
    setEtat((x) => ({ ...x, [m.id]: "en_cours" }));
    try {
      const res = await fetch(`${API_URL}/api/missions/${m.id}/statut`, {
        method: "PUT",
        headers: await authHeaders(),
        body: JSON.stringify({ statut, compte_rendu: notes[m.id] ?? m.compte_rendu ?? "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      setMissions((prev) => prev.map((x) => (x.id === m.id ? data : x)));
      setEtat((x) => { const n = { ...x }; delete n[m.id]; return n; });
    } catch (err) {
      setEtat((x) => ({ ...x, [m.id]: err.message }));
    }
  };

  const faites = missions.filter((m) => m.statut === "terminee").length;

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ marginBottom: 4 }}>Mes missions</h1>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, margin: "8px 0 16px" }}>
        <button onClick={() => setSemaine(decaler(semaine, -7))} style={{ padding: "8px 12px" }}>←</button>
        <div style={{ textAlign: "center", fontWeight: 700, fontSize: 14 }}>
          {libelleSemaine(semaine)}
          {semaine !== lundiDe(new Date()) && (
            <div><button onClick={() => setSemaine(lundiDe(new Date()))} style={{ background: "none", border: "none", color: "#F5720C", fontSize: 12, fontWeight: 600 }}>Revenir à cette semaine</button></div>
          )}
        </div>
        <button onClick={() => setSemaine(decaler(semaine, 7))} style={{ padding: "8px 12px" }}>→</button>
      </div>

      {missions.length > 0 && (
        <p style={{ color: "#7A7A7A", fontSize: 13 }}>{faites} mission{faites > 1 ? "s" : ""} terminée{faites > 1 ? "s" : ""} sur {missions.length}</p>
      )}

      {erreur && <p style={{ color: "red", fontSize: 13 }}>{erreur}</p>}
      {chargement && <p style={{ color: "#999" }}>Chargement...</p>}
      {!chargement && !erreur && missions.length === 0 && (
        <p style={{ color: "#999" }}>Aucune mission pour cette semaine. Elles apparaîtront ici dès que l'administrateur les enverra.</p>
      )}

      {missions.map((m) => (
        <div key={m.id} style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <strong style={{ fontSize: 15 }}>{m.titre}</strong>
          {m.description && <p style={{ margin: "6px 0 0", fontSize: 13, color: "#555", whiteSpace: "pre-wrap" }}>{m.description}</p>}

          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {STATUTS.map((s) => {
              const actif = m.statut === s.cle;
              return (
                <button
                  key={s.cle}
                  onClick={() => !actif && mettreAJour(m, s.cle)}
                  disabled={etat[m.id] === "en_cours"}
                  style={{
                    padding: "6px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    border: `1px solid ${s.couleur}`, background: actif ? s.couleur : "#fff", color: actif ? "#fff" : s.couleur,
                  }}
                >
                  {s.texte}
                </button>
              );
            })}
          </div>

          <textarea
            value={notes[m.id] ?? m.compte_rendu ?? ""}
            onChange={(e) => setNotes((x) => ({ ...x, [m.id]: e.target.value }))}
            placeholder="Votre retour sur cette mission (optionnel)"
            rows={2}
            maxLength={2000}
            style={{ width: "100%", boxSizing: "border-box", marginTop: 10, border: "1px solid #ddd", borderRadius: 6, padding: 8, fontSize: 13, fontFamily: "inherit" }}
          />
          {notes[m.id] !== undefined && notes[m.id] !== (m.compte_rendu ?? "") && (
            <button onClick={() => mettreAJour(m, m.statut)} style={{ marginTop: 4, background: "none", border: "none", color: "#F5720C", fontWeight: 700, fontSize: 13, padding: 0 }}>
              Enregistrer mon retour
            </button>
          )}
          {etat[m.id] && etat[m.id] !== "en_cours" && <p style={{ color: "red", fontSize: 12, margin: "6px 0 0" }}>{etat[m.id]}</p>}
        </div>
      ))}
    </div>
  );
}
