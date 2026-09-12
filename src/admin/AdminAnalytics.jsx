import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token}` };
}

function StatCard({ label, value }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#F5720C" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#7A7A7A" }}>{label}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 28 }}>
      <h3 style={{ marginBottom: 10 }}>{title}</h3>
      {children}
    </div>
  );
}

function Table({ columns, rows }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#F3F3F3", textAlign: "left" }}>
            {columns.map((c) => (
              <th key={c.key} style={{ padding: "10px 12px" }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: "1px solid #eee" }}>
              {columns.map((c) => (
                <td key={c.key} style={{ padding: "10px 12px" }}>
                  {c.render ? c.render(r[c.key], r) : (r[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} style={{ padding: 16, color: "#999" }}>Aucune donnée</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminAnalytics() {
  const [boutiques, setBoutiques] = useState([]);
  const [actifs, setActifs] = useState([]);
  const [typesVisiteurs, setTypesVisiteurs] = useState([]);
  const [retention, setRetention] = useState([]);
  const [frequenceConnexion, setFrequenceConnexion] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    async function charger() {
      const headers = await authHeaders();
      const [rBoutiques, rActifs, rTypes, rRetention, rFreq] = await Promise.all([
        fetch(`${API_URL}/api/admin-analytics/boutiques`, { headers }),
        fetch(`${API_URL}/api/admin-analytics/utilisateurs-actifs`, { headers }),
        fetch(`${API_URL}/api/admin-analytics/types-visiteurs?jours=7`, { headers }),
        fetch(`${API_URL}/api/admin-analytics/retention`, { headers }),
        fetch(`${API_URL}/api/admin-analytics/frequence-connexion`, { headers }),
      ]);
      if (rBoutiques.ok) setBoutiques(await rBoutiques.json());
      if (rActifs.ok) setActifs(await rActifs.json());
      if (rTypes.ok) setTypesVisiteurs(await rTypes.json());
      if (rRetention.ok) setRetention(await rRetention.json());
      if (rFreq.ok) setFrequenceConnexion(await rFreq.json());
      setChargement(false);
    }
    charger();
  }, []);

  const dau = actifs.find((a) => a.periode === "24h")?.visiteurs_uniques ?? "—";
  const wau = actifs.find((a) => a.periode === "7j")?.visiteurs_uniques ?? "—";
  const mau = actifs.find((a) => a.periode === "30j")?.visiteurs_uniques ?? "—";
  const nouveaux = typesVisiteurs.find((t) => t.type_visiteur === "nouveau")?.nb ?? 0;
  const recurrents = typesVisiteurs.find((t) => t.type_visiteur === "recurrent")?.nb ?? 0;
  const dernierTauxRetention = retention[0]?.taux_retention;

  if (chargement) return <p>Chargement des statistiques…</p>;

  return (
    <div>
      <h1>Statistiques d'utilisation</h1>

      <Section title="Visiteurs actifs">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <StatCard label="Actifs (24h)" value={dau} />
          <StatCard label="Actifs (7 jours)" value={wau} />
          <StatCard label="Actifs (30 jours)" value={mau} />
        </div>
      </Section>

      <Section title="Types de visiteurs (7 derniers jours)">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <StatCard label="Nouveaux visiteurs" value={nouveaux} />
          <StatCard label="Visiteurs récurrents" value={recurrents} />
          <StatCard label="Taux de rétention J+7 (dernière cohorte)" value={dernierTauxRetention != null ? `${dernierTauxRetention}%` : "—"} />
        </div>
      </Section>

      <Section title="Performance par boutique (clics WhatsApp, visites, connexions du propriétaire)">
        <Table
          columns={[
            { key: "nom", label: "Boutique" },
            { key: "clics_whatsapp", label: "Clics WhatsApp" },
            { key: "visites", label: "Visites" },
            { key: "visiteurs_uniques", label: "Visiteurs uniques" },
            { key: "nb_connexions_owner", label: "Connexions propriétaire" },
            { key: "derniere_visite", label: "Dernière visite", render: formatDate },
            { key: "derniere_connexion", label: "Dernière connexion", render: formatDate },
          ]}
          rows={boutiques}
        />
      </Section>

      <Section title="Fréquence de connexion par boutique">
        <Table
          columns={[
            { key: "nom", label: "Boutique" },
            { key: "nb_connexions", label: "Nombre de connexions" },
            { key: "premiere_connexion", label: "Première connexion", render: formatDate },
            { key: "derniere_connexion", label: "Dernière connexion", render: formatDate },
          ]}
          rows={frequenceConnexion}
        />
      </Section>

      <Section title="Rétention par cohorte (visiteurs revenus dans les 7 jours)">
        <Table
          columns={[
            { key: "cohorte", label: "Jour de première visite" },
            { key: "nb_nouveaux", label: "Nouveaux visiteurs" },
            { key: "nb_revenus", label: "Revenus sous 7j" },
            { key: "taux_retention", label: "Taux", render: (v) => (v != null ? `${v}%` : "—") },
          ]}
          rows={retention}
        />
      </Section>
    </div>
  );
}
