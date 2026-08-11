import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";

function StatCard({ label, value }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#F5720C" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#7A7A7A" }}>{label}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({});
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    async function charger() {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/admin-stats`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) setStats(await res.json());
    }
    charger();

    async function chargerNotifs() {
      const { data } = await supabase
        .from("reponses_requetes")
        .select("*, requetes(description)")
        .eq("vue", false)
        .order("created_at", { ascending: false });
      setNotifications(data || []);
    }
    chargerNotifs();

    const channel = supabase
      .channel("reponses-requetes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reponses_requetes" },
        (payload) => setNotifications((prev) => [payload.new, ...prev])
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  return (
    <div>
      <h1>Vue d'ensemble</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16 }}>
        <StatCard label="Boutiques à valider" value={stats.boutiquesEnAttente ?? "—"} />
        <StatCard label="Maisons disponibles" value={stats.maisonsDispo ?? "—"} />
        <StatCard label="Requêtes ouvertes" value={stats.requetesOuvertes ?? "—"} />
        <StatCard label="Réponses non lues" value={stats.reponsesNonLues ?? "—"} />
      </div>

      <h3 style={{ marginTop: 24 }}>Nouvelles réponses ({notifications.length})</h3>
      <div style={{ marginTop: 8 }}>
        {notifications.map((r) => (
          <div key={r.id} style={{ background: "#fff", padding: 10, borderRadius: 8, marginBottom: 8 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{r.requetes?.description}</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#666" }}>
              {r.message} {r.prix_propose && `— ${r.prix_propose} $`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
    }
            
