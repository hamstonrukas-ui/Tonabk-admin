import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` };
}

function BoutiqueRow({ boutique, onMarquerVue, onSuspendre, onReactiver, onSupprimer, onCertifier }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderBottom: "1px solid #eee", background: "#fff" }}>
      <div>
        <strong>{boutique.nom}</strong> — {boutique.categories?.nom}
        <div style={{ fontSize: 11, color: "#7A7A7A" }}>
          {boutique.telephone} • {boutique.quartier} • statut : {boutique.statut}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => onMarquerVue(boutique.id)}>Marquer comme examinée</button>
        <button onClick={() => onCertifier(boutique.id)}>Certifier (30j)</button>
        {boutique.statut === "actif" ? (
          <button onClick={() => onSuspendre(boutique.id)}>Suspendre</button>
        ) : (
          <button onClick={() => onReactiver(boutique.id)}>Réactiver</button>
        )}
        <button
          style={{ color: "red" }}
          onClick={() => {
            if (confirm(`Supprimer définitivement "${boutique.nom}" ? Cette action est irréversible.`)) {
              onSupprimer(boutique.id);
            }
          }}
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}

export default function AdminBoutiques() {
  const [boutiques, setBoutiques] = useState([]);

  async function charger() {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/boutiques/admin/nouvelles`, { headers });
    if (res.ok) setBoutiques(await res.json());
  }

  useEffect(() => { charger(); }, []);

  const marquerVue = async (id) => {
    const headers = await authHeaders();
    await fetch(`${API_URL}/api/boutiques/admin/${id}/marquer-vue`, { method: "PUT", headers });
    charger();
  };

  const suspendre = async (id) => {
    const headers = await authHeaders();
    await fetch(`${API_URL}/api/boutiques/admin/${id}/suspendre`, { method: "PUT", headers });
    charger();
  };

  const reactiver = async (id) => {
    const headers = await authHeaders();
    await fetch(`${API_URL}/api/boutiques/admin/${id}/reactiver`, { method: "PUT", headers });
    charger();
  };

  const supprimer = async (id) => {
    const headers = await authHeaders();
    await fetch(`${API_URL}/api/boutiques/admin/${id}`, { method: "DELETE", headers });
    charger();
  };

  const certifier = async (id) => {
    const headers = await authHeaders();
    await fetch(`${API_URL}/api/boutiques/admin/${id}/certifier`, {
      method: "PUT", headers, body: JSON.stringify({ jours: 30 }),
    });
    charger();
  };

  return (
    <div>
      <h1>Nouvelles boutiques</h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
        Ces boutiques sont déjà actives et visibles publiquement. Cette liste sert juste à ton suivi —
        marque-les comme examinées une fois vérifiées, ou suspends-les si un problème apparaît.
      </p>
      <div style={{ marginTop: 8, borderRadius: 10, overflow: "hidden" }}>
        {boutiques.map((b) => (
          <BoutiqueRow
            key={b.id}
            boutique={b}
            onMarquerVue={marquerVue}
            onSuspendre={suspendre}
            onReactiver={reactiver}
            onSupprimer={supprimer}
            onCertifier={certifier}
          />
        ))}
        {boutiques.length === 0 && <p style={{ padding: 16, color: "#999" }}>Aucune nouvelle boutique à examiner</p>}
      </div>
    </div>
  );
}
