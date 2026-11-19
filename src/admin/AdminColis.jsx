// Colis déposés par les clients (formulaire « Déposer mon colis »).
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";

const ORANGE = "#F5720C";
const STATUTS = { nouveau: "Nouveau", en_cours: "En cours", termine: "Terminé" };
const COULEURS = { nouveau: "#C62828", en_cours: ORANGE, termine: "#2E9E5B" };

async function entetes() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" };
}

export default function AdminColis() {
  const [liste, setListe] = useState([]);
  const [filtre, setFiltre] = useState("tous");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  const charger = async () => {
    try {
      const r = await fetch(`${API_URL}/api/colis`, { headers: await entetes() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erreur");
      setListe(d); setErreur("");
    } catch (e) { setErreur(e.message || "Chargement impossible"); }
    setChargement(false);
  };
  useEffect(() => { charger(); }, []);

  const maj = async (id, champs) => {
    setListe((l) => l.map((c) => (c.id === id ? { ...c, ...champs } : c)));
    const r = await fetch(`${API_URL}/api/colis/${id}`, { method: "PATCH", headers: await entetes(), body: JSON.stringify(champs) });
    if (!r.ok) { setErreur("Modification impossible"); charger(); }
  };
  const supprimer = async (id) => {
    if (!window.confirm("Supprimer cette demande ?")) return;
    const r = await fetch(`${API_URL}/api/colis/${id}`, { method: "DELETE", headers: await entetes() });
    if (r.ok) setListe((l) => l.filter((c) => c.id !== id)); else setErreur("Suppression impossible");
  };
  const whatsapp = (c) => {
    const num = c.telephone.replace(/\D/g, "");
    const msg = `Bonjour${c.nom ? " " + c.nom : ""}, nous avons bien reçu votre demande de colis (${c.depart} → ${c.destination}).`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const visibles = filtre === "tous" ? liste : liste.filter((c) => c.statut === filtre);
  const nb = (s) => liste.filter((c) => c.statut === s).length;

  return (
    <div>
      <h1>Colis à expédier</h1>
      <p style={{ fontSize: 13, color: "#666" }}>Demandes envoyées par les clients avec le bouton « Déposer mon colis ».</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "12px 0" }}>
        {[["tous", `Tous (${liste.length})`], ["nouveau", `Nouveaux (${nb("nouveau")})`], ["en_cours", `En cours (${nb("en_cours")})`], ["termine", `Terminés (${nb("termine")})`]].map(([k, t]) => (
          <button key={k} onClick={() => setFiltre(k)} style={{ padding: "6px 12px", borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: `1px solid ${ORANGE}`, background: filtre === k ? ORANGE : "#fff", color: filtre === k ? "#fff" : ORANGE }}>{t}</button>
        ))}
      </div>
      {erreur && <p style={{ color: "red", fontSize: 13 }}>{erreur}</p>}
      {chargement && <p style={{ fontSize: 13, color: "#888" }}>Chargement…</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 720 }}>
        {visibles.map((c) => (
          <div key={c.id} style={{ background: "#fff", borderRadius: 10, padding: 12, borderLeft: `4px solid ${COULEURS[c.statut] || "#ccc"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 14 }}>{c.depart} → {c.destination}</strong>
              <span style={{ fontSize: 11, color: "#888" }}>{new Date(c.cree_le).toLocaleString("fr-FR")}</span>
            </div>
            <p style={{ fontSize: 13, margin: "6px 0", whiteSpace: "pre-line" }}>{c.description}</p>
            {c.photos?.length > 0 && (
              <div style={{ display: "flex", gap: 6, margin: "6px 0" }}>
                {c.photos.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }} /></a>)}
              </div>
            )}
            <p style={{ fontSize: 12, color: "#444", margin: "4px 0" }}>👤 {c.nom || "Sans nom"} · 📱 {c.telephone}</p>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
              <select value={c.statut} onChange={(e) => maj(c.id, { statut: e.target.value })} style={{ padding: 6, borderRadius: 6, border: "1px solid #ddd" }}>
                {Object.entries(STATUTS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
              <button onClick={() => whatsapp(c)} style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: "#25D366", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>WhatsApp</button>
              <button onClick={() => supprimer(c.id)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #C62828", background: "#fff", color: "#C62828", fontSize: 12, cursor: "pointer" }}>Supprimer</button>
            </div>
            <input defaultValue={c.note || ""} placeholder="Note interne (ex. colis reçu, prix…)" onBlur={(e) => e.target.value !== (c.note || "") && maj(c.id, { note: e.target.value })}
              style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: 7, borderRadius: 6, border: "1px solid #eee", fontSize: 12 }} />
          </div>
        ))}
        {!chargement && !erreur && visibles.length === 0 && <p style={{ fontSize: 13, color: "#888" }}>Aucune demande.</p>}
      </div>
    </div>
  );
}
