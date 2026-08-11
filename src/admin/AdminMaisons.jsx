import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` };
}

export default function AdminMaisons() {
  const [maisons, setMaisons] = useState([]);

  async function charger() {
    const res = await fetch(`${API_URL}/api/maisons`);
    if (res.ok) setMaisons(await res.json());
  }

  useEffect(() => { charger(); }, []);

  const suspendre = async (id) => {
    const headers = await authHeaders();
    await fetch(`${API_URL}/api/maisons/admin/${id}/suspendre`, { method: "PUT", headers });
    charger();
  };

  const supprimer = async (id) => {
    const headers = await authHeaders();
    await fetch(`${API_URL}/api/maisons/admin/${id}`, { method: "DELETE", headers });
    charger();
  };

  return (
    <div>
      <h1>Maisons</h1>
      <div style={{ marginTop: 16, borderRadius: 10, overflow: "hidden" }}>
        {maisons.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderBottom: "1px solid #eee", background: "#fff" }}>
            <div>
              <strong>{m.titre}</strong> — {m.quartier}
              <div style={{ fontSize: 11, color: "#7A7A7A" }}>{m.prix} {m.devise} • {m.statut}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => suspendre(m.id)}>Suspendre</button>
              <button
                style={{ color: "red" }}
                onClick={() => {
                  if (confirm(`Supprimer "${m.titre}" ?`)) supprimer(m.id);
                }}
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
        {maisons.length === 0 && <p style={{ padding: 16, color: "#999" }}>Aucune maison</p>}
      </div>
    </div>
  );
}
