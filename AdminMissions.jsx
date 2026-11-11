// Page admin : envoyer les missions de la semaine au personnel et suivre leur avancement.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` };
}

// Lundi (AAAA-MM-JJ) de la semaine contenant la date donnée
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

const STATUT = {
  a_faire: { texte: "À faire", couleur: "#7A7A7A" },
  en_cours: { texte: "En cours", couleur: "#F5720C" },
  terminee: { texte: "✓ Terminée", couleur: "#2E7D32" },
};

export default function AdminMissions() {
  const [semaine, setSemaine] = useState(() => lundiDe(new Date()));
  const [missions, setMissions] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");

  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [tous, setTous] = useState(true);
  const [choisis, setChoisis] = useState(() => new Set());
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/api/missions?semaine=${semaine}`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(res.status === 404 ? "Route des missions introuvable : redéployez le backend." : data.error || `Erreur ${res.status}`);
      setMissions(data.missions || []);
    } catch (err) {
      setErreur(err.message || "Impossible de contacter le serveur");
    }
    setChargement(false);
  }, [semaine]);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/personnel`, { headers: await authHeaders() });
        if (res.ok) setPersonnel(await res.json());
      } catch { /* la liste des employés reste vide */ }
    })();
  }, []);

  const basculer = (id) =>
    setChoisis((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const envoyer = async (e) => {
    e.preventDefault();
    setErreur("");
    setMessage("");
    if (!titre.trim()) return setErreur("Donnez un titre à la mission");
    if (!tous && choisis.size === 0) return setErreur("Choisissez au moins un employé");

    setEnvoiEnCours(true);
    try {
      const res = await fetch(`${API_URL}/api/missions`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          titre, description, semaine_debut: semaine,
          ...(tous ? { tous: true } : { personnel_ids: [...choisis] }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      setMessage(`Mission envoyée à ${data.envoyees} employé(s).`);
      setTitre("");
      setDescription("");
      charger();
    } catch (err) {
      setErreur(err.message);
    }
    setEnvoiEnCours(false);
  };

  const supprimer = async (id) => {
    if (!window.confirm("Supprimer cette mission ?")) return;
    try {
      const res = await fetch(`${API_URL}/api/missions/${id}`, { method: "DELETE", headers: await authHeaders() });
      if (!res.ok) throw new Error();
      setMissions((prev) => prev.filter((m) => m.id !== id));
    } catch {
      setErreur("Impossible de supprimer la mission");
    }
  };

  // Regroupement par employé
  const parEmploye = {};
  for (const m of missions) (parEmploye[m.personnel_id] ||= { nom: m.nom, liste: [] }).liste.push(m);

  const champ = { width: "100%", boxSizing: "border-box", border: "1px solid #ddd", borderRadius: 6, padding: 10, fontSize: 14, fontFamily: "inherit" };

  return (
    <div style={{ maxWidth: 640 }}>
      <h1>Missions de la semaine</h1>

      {/* Choix de la semaine */}
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

      {/* Nouvelle mission */}
      <form onSubmit={envoyer} style={{ background: "#fff", borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Envoyer une mission</h3>
        <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Titre (ex : Visiter 10 boutiques à Nguba)" maxLength={200} style={{ ...champ, marginBottom: 8 }} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Détails, consignes (optionnel)" rows={3} maxLength={2000} style={{ ...champ, marginBottom: 10 }} />

        <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700 }}>Pour qui ?</p>
        <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          <input type="checkbox" checked={tous} onChange={(e) => setTous(e.target.checked)} /> Tout le personnel
        </label>
        {!tous && personnel.map((p) => (
          <label key={p.id} style={{ display: "block", fontSize: 14, marginBottom: 4, marginLeft: 18 }}>
            <input type="checkbox" checked={choisis.has(p.id)} onChange={() => basculer(p.id)} /> {p.nom}
          </label>
        ))}

        <button type="submit" disabled={envoiEnCours} style={{ width: "100%", marginTop: 12, background: "#F5720C", color: "#fff", border: "none", borderRadius: 8, padding: 12, fontWeight: 700, fontSize: 15, opacity: envoiEnCours ? 0.6 : 1 }}>
          {envoiEnCours ? "Envoi..." : "Envoyer la mission"}
        </button>
        {message && <p style={{ color: "#2E7D32", fontSize: 13, marginBottom: 0 }}>{message}</p>}
      </form>

      {erreur && <p style={{ color: "red", fontSize: 13 }}>{erreur}</p>}
      {chargement && <p style={{ color: "#999" }}>Chargement...</p>}
      {!chargement && !erreur && missions.length === 0 && <p style={{ color: "#999" }}>Aucune mission pour cette semaine.</p>}

      {/* Missions par employé */}
      {Object.entries(parEmploye).map(([id, { nom, liste }]) => {
        const faites = liste.filter((m) => m.statut === "terminee").length;
        return (
          <div key={id} style={{ marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 8px" }}>
              {nom} <span style={{ fontWeight: 400, color: "#999", fontSize: 13 }}>— {faites}/{liste.length} terminée{faites > 1 ? "s" : ""}</span>
            </h3>
            <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden" }}>
              {liste.map((m) => {
                const st = STATUT[m.statut] || STATUT.a_faire;
                return (
                  <div key={m.id} style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong style={{ fontSize: 14 }}>{m.titre}</strong>
                      <span style={{ fontSize: 11, fontWeight: 700, color: st.couleur, whiteSpace: "nowrap" }}>{st.texte}</span>
                    </div>
                    {m.description && <p style={{ margin: "4px 0 0", fontSize: 13, color: "#555", whiteSpace: "pre-wrap" }}>{m.description}</p>}
                    {m.compte_rendu && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#444", background: "#FAFAFA", padding: 8, borderRadius: 6, whiteSpace: "pre-wrap" }}><strong>Retour de l'employé :</strong> {m.compte_rendu}</p>}
                    <button onClick={() => supprimer(m.id)} style={{ marginTop: 6, background: "none", border: "none", color: "red", fontSize: 12, padding: 0 }}>Supprimer</button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
