// Résumé de la semaine de l'employé connecté (affiché dans « Mes missions »).
// Chacun ne voit que SON résumé : manques en rouge, excédents en vert.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";

const ORANGE = "#F5720C";
const NOMS = { app: "Gestion de l'application", sensi: "Sensibilisation terrain", clients: "Gestion des clients" };
const fmt = (n) => Number(n || 0).toLocaleString("fr-FR");
const lundiLocal = () => {
  const d = new Date(Date.now() + 2 * 3600 * 1000);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const decaler = (lundi, n) => { const d = new Date(`${lundi}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 7 * n); return d.toISOString().slice(0, 10); };
const libelle = (lundi) => {
  const a = new Date(`${lundi}T12:00:00Z`), b = new Date(a); b.setUTCDate(b.getUTCDate() + 6);
  const f = (x) => x.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${f(a)} → ${f(b)}`;
};
const cellule = { padding: "4px 6px", fontSize: 13, borderBottom: "1px solid #f3f3f3" };

export default function MonResumeSemaine() {
  const [lundi, setLundi] = useState(lundiLocal());
  const [moi, setMoi] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let annule = false;
    setMoi(null); setErreur("");
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const r = await fetch(`${API_URL}/api/tableau-personnel/resume-semaine?semaine=${lundi}`, { headers: { Authorization: `Bearer ${session?.access_token}` } });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Erreur");
        if (!annule) setMoi(d.personnel.find((l) => l.id === d.moi) || false);
      } catch (e) { if (!annule) setErreur(e.message || "Chargement impossible"); }
    })();
    return () => { annule = true; };
  }, [lundi]);

  const r = moi?.remuneration;
  const manques = r ? Object.values(r.missions).flatMap((x) => x.details.filter((d) => d.ecart < 0)).length : 0;
  const excedents = r ? Object.values(r.missions).flatMap((x) => x.details.filter((d) => d.ecart > 0)).length : 0;

  return (
    <div style={{ background: "#fff", border: `2px solid ${ORANGE}`, borderRadius: 12, padding: 14, margin: "10px 0 18px" }}>
      <strong style={{ fontSize: 15 }}>Mon résumé de la semaine</strong>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, margin: "8px 0" }}>
        <button onClick={() => setLundi(decaler(lundi, -1))} style={{ padding: "6px 12px" }}>←</button>
        <div style={{ fontWeight: 700, fontSize: 13, textAlign: "center" }}>{libelle(lundi)}{lundi === lundiLocal() ? " (en cours)" : ""}</div>
        <button onClick={() => setLundi(decaler(lundi, 1))} disabled={lundi >= lundiLocal()} style={{ padding: "6px 12px", opacity: lundi >= lundiLocal() ? 0.4 : 1 }}>→</button>
      </div>

      {erreur && <p style={{ color: "red", fontSize: 13 }}>{erreur}</p>}
      {!r && !erreur && moi !== false && <p style={{ fontSize: 13, color: "#888" }}>Chargement…</p>}
      {moi === false && <p style={{ fontSize: 13, color: "#888" }}>Aucun résumé disponible pour votre compte.</p>}

      {r && (
        <>
          <div style={{ fontSize: 26, fontWeight: 800, color: ORANGE, lineHeight: 1.2 }}>
            {fmt(r.total)} <span style={{ fontSize: 13, color: "#888", fontWeight: 600 }}>/ {fmt(r.max)} points · {r.pct} %</span>
          </div>
          <div style={{ height: 8, background: "#f1f1f1", borderRadius: 4, margin: "6px 0", overflow: "hidden" }}>
            <div style={{ width: `${Math.min(r.pct, 100)}%`, height: "100%", background: ORANGE }} />
          </div>
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            <span style={{ color: manques ? "#c0392b" : "#1e8e3e", fontWeight: 700 }}>{manques ? `${manques} en manque` : "Aucun manque"}</span>
            {" · "}<span style={{ color: excedents ? "#1e8e3e" : "#888", fontWeight: 700 }}>{excedents ? `${excedents} excédent(s)` : "aucun excédent"}</span>
          </div>

          {Object.entries(r.missions).map(([m, x]) => (
            <div key={m} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: x.pct < 100 ? "#c0392b" : "#1e8e3e" }}>{NOMS[m]} — {x.pct} %{x.surplus > 0 ? ` (excédent +${x.surplus} %)` : ""}</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {x.details.map((d) => (
                    <tr key={d.libelle} style={{ background: d.ecart < 0 ? "#FFF1F0" : d.ecart > 0 ? "#EEF8F0" : undefined }}>
                      <td style={cellule}>{d.libelle}</td>
                      <td style={{ ...cellule, textAlign: "right", whiteSpace: "nowrap" }}>{fmt(d.fait)} / {fmt(d.cible)}</td>
                      <td style={{ ...cellule, textAlign: "right", whiteSpace: "nowrap", fontWeight: 700, color: d.ecart < 0 ? "#c0392b" : "#1e8e3e" }}>{d.ecart < 0 ? `manque ${fmt(-d.ecart)}` : d.ecart > 0 ? `+${fmt(d.ecart)}` : "atteint ✓"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <div style={{ background: "#FFF6EE", border: `1px solid ${ORANGE}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.5, color: "#444", marginTop: 10 }}>
            <div><b style={{ color: "#c0392b" }}>⚠ Les manques peuvent affecter votre salaire mensuel et le diminuer.</b></div>
            <div><b style={{ color: "#1e8e3e" }}>★ Les excédents sont encouragés par des primes.</b></div>
          </div>
        </>
      )}
    </div>
  );
}
