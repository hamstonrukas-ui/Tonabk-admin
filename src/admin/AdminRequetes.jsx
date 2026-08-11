import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` };
}

export default function AdminRequetes() {
  const [requetes, setRequetes] = useState([]);

  async function charger() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/requetes/admin/toutes`, { headers });
    if (res.ok) setRequetes(await res.json());
  }

  useEffect(() => { charger(); }, []);

  const changerStatut = async (id, statut) => {
    const headers = await authHeaders();
    await fetch(`${API_URL}/api/requetes/${id}/statut`, { method: "PUT", headers, body: JSON.stringify({ statut }) });
    charger();
  };

  const supprimer = async (id) => {
    const headers = await authHeaders();
    await fetch(`${API_URL}/api/requetes/admin/${id}`, { method: "DELETE", headers });
    charger();
  };

  return (
    <div>
      <h1>Requêtes</h1>
      <div style={{ marginTop: 16 }}>
        {requetes.map((r) => (
          <div key={r.id} style={{ background: "#fff", borderRadius: 10, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{r.description}</strong>
              <span style={{ fontSize: 11, color: "#7A7A7A" }}>{r.statut}</span>
            </div>
            <p style={{ fontSize: 12, color: "#666" }}>Tél. demandeur : {r.telephone}</p>

            <p style={{ fontSize: 12, fontWeight: 700, marginTop: 8 }}>Réponses ({r.reponses_requetes?.length || 0})</p>
            {r.reponses_requetes?.map((rep) => (
              <div key={rep.id} style={{ fontSize: 12, background: "#F6F6F6", padding: 8, borderRadius: 6, marginTop: 4 }}>
                {rep.message} {rep.prix_propose && `— ${rep.prix_propose} $`}
              </div>
            ))}

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => changerStatut(r.id, "en_cours")}>En cours</button>
              <button onClick={() => changerStatut(r.id, "trouvee")}>Trouvée</button>
              <button onClick={() => changerStatut(r.id, "fermee")}>Fermer</button>
              <button style={{ color: "red" }} onClick={() => supprimer(r.id)}>Supprimer</button>
            </div>
          </div>
        ))}
        {requetes.length === 0 && <p style={{ color: "#999" }}>Aucune requête</p>}
      </div>
    </div>
  );
}
