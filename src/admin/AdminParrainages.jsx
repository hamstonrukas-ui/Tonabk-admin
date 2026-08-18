import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` };
}

export default function AdminParrainages() {
  const [parrainages, setParrainages] = useState([]);

  async function charger() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/parrainage/admin/tous`, { headers });
    if (res.ok) setParrainages(await res.json());
  }

  useEffect(() => { charger(); }, []);

  const changerStatut = async (id, statut) => {
    const headers = await authHeaders();
    await fetch(`${API_URL}/api/parrainage/admin/${id}/statut`, {
      method: "PUT", headers, body: JSON.stringify({ statut }),
    });
    charger();
  };

  return (
    <div>
      <h1>Parrainages</h1>
      <div style={{ marginTop: 16 }}>
        {parrainages.map((p) => (
          <div key={p.id} style={{ background: "#fff", borderRadius: 10, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{p.filleul_nom}</strong>
              <span style={{
                fontSize: 11,
                color: p.statut === "validee" ? "#1E9E5A" : p.statut === "refusee" ? "#E0342B" : "#C9560A",
                fontWeight: 700,
              }}>
                {p.statut === "validee" ? "Validé" : p.statut === "refusee" ? "Refusé" : "En attente"}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "#666", margin: "4px 0" }}>
              Boutique : {p.boutiques?.nom} — Code : {p.codes_parrainage?.code}
            </p>
            <p style={{ fontSize: 11, color: "#999", margin: 0 }}>
              {new Date(p.created_at).toLocaleDateString("fr-FR")} — Récompense : {p.recompense}
            </p>

            {p.statut === "en_attente" && (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => changerStatut(p.id, "validee")}>Valider</button>
                <button onClick={() => changerStatut(p.id, "refusee")}>Refuser</button>
              </div>
            )}
          </div>
        ))}
        {parrainages.length === 0 && <p style={{ color: "#999" }}>Aucun parrainage pour l'instant</p>}
      </div>
    </div>
  );
}
