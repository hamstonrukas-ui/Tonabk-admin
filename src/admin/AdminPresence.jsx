import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` };
}

// Récupère la position GPS du téléphone/ordinateur, avec un message clair en cas de refus.
function obtenirPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Géolocalisation non disponible sur cet appareil"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error("Position refusée — autorisez la géolocalisation pour signer la présence")),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

export default function AdminPresence() {
  const [presence, setPresence] = useState(undefined); // undefined = chargement, null = rien aujourd'hui
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [activites, setActivites] = useState("");
  const [difficultes, setDifficultes] = useState("");

  async function charger() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/presences/aujourdhui`, { headers });
    if (res.ok) setPresence(await res.json());
  }

  useEffect(() => { charger(); }, []);

  const signer = async () => {
    setErreur("");
    setEnCours(true);
    try {
      const { lat, lng } = await obtenirPosition();
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/api/presences/signer`, {
        method: "POST", headers, body: JSON.stringify({ lat, lng }),
      });
      const data = await res.json();
      if (!res.ok) { setErreur(data.error); setEnCours(false); return; }
      setPresence(data);
    } catch (err) {
      setErreur(err.message);
    }
    setEnCours(false);
  };

  const cloturer = async (e) => {
    e.preventDefault();
    setErreur("");
    if (!activites.trim()) { setErreur("Décrivez les activités réalisées"); return; }

    setEnCours(true);
    try {
      const { lat, lng } = await obtenirPosition();
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/api/presences/cloturer`, {
        method: "PUT", headers,
        body: JSON.stringify({ lat, lng, activites, difficultes }),
      });
      const data = await res.json();
      if (!res.ok) { setErreur(data.error); setEnCours(false); return; }
      setPresence(data);
    } catch (err) {
      setErreur(err.message);
    }
    setEnCours(false);
  };

  if (presence === undefined) return <p>Chargement...</p>;

  return (
    <div style={{ maxWidth: 420 }}>
      <h1>Présence du jour</h1>
      {erreur && <p style={{ color: "red", fontSize: 13 }}>{erreur}</p>}

      {!presence && (
        <div style={{ background: "#fff", borderRadius: 10, padding: 20, textAlign: "center" }}>
          <p style={{ color: "#666", marginBottom: 16 }}>Vous n'avez pas encore signé votre présence aujourd'hui.</p>
          <button onClick={signer} disabled={enCours} style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "12px 24px", fontWeight: 600 }}>
            {enCours ? "Localisation..." : "Signer la présence"}
          </button>
        </div>
      )}

      {presence && !presence.heure_fin && (
        <>
          <div style={{ background: "#fff", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <p style={{ margin: 0, color: "#2E7D32", fontWeight: 600 }}>✓ Présence signée à {new Date(presence.heure_debut).toLocaleTimeString("fr-FR")}</p>
          </div>

          <form onSubmit={cloturer} style={{ background: "#fff", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <h3 style={{ margin: 0 }}>Clôturer la journée</h3>
            <label style={{ fontSize: 13, color: "#666" }}>
              Activités réalisées
              <textarea value={activites} onChange={(e) => setActivites(e.target.value)} rows={3} required style={{ width: "100%", marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 13, color: "#666" }}>
              Difficultés rencontrées (optionnel)
              <textarea value={difficultes} onChange={(e) => setDifficultes(e.target.value)} rows={3} style={{ width: "100%", marginTop: 4 }} />
            </label>
            <button type="submit" disabled={enCours} style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "12px 0", fontWeight: 600 }}>
              {enCours ? "Localisation..." : "Clôturer la journée"}
            </button>
          </form>
        </>
      )}

      {presence && presence.heure_fin && (
        <div style={{ background: "#fff", borderRadius: 10, padding: 16 }}>
          <p style={{ color: "#2E7D32", fontWeight: 600, marginTop: 0 }}>✓ Journée clôturée à {new Date(presence.heure_fin).toLocaleTimeString("fr-FR")}</p>
          <p style={{ fontSize: 13 }}><strong>Activités :</strong> {presence.activites}</p>
          {presence.difficultes && <p style={{ fontSize: 13 }}><strong>Difficultés :</strong> {presence.difficultes}</p>}
          <p style={{ fontSize: 12, color: "#999" }}>À demain !</p>
        </div>
      )}
    </div>
  );
}
