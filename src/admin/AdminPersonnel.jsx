import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` };
}

export default function AdminPersonnel() {
  const [personnel, setPersonnel] = useState([]);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [dernierCree, setDernierCree] = useState(null);
  const [erreurListe, setErreurListe] = useState("");
  const [resume, setResume] = useState({});
  const [lienCopie, setLienCopie] = useState(null);

  async function charger() {
    setErreurListe("");
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/api/personnel`, { headers });
      fetch(`${API_URL}/api/suivi-personnel/resume`, { headers })
        .then((r) => (r.ok ? r.json() : {}))
        .then(setResume)
        .catch(() => {});
      if (res.ok) {
        setPersonnel(await res.json());
      } else {
        const data = await res.json().catch(() => ({}));
        setErreurListe(data.error || `Erreur ${res.status} du serveur`);
      }
    } catch {
      setErreurListe("Impossible de contacter le serveur (vérifiez VITE_API_URL et la connexion)");
    }
  }

  useEffect(() => { charger(); }, []);

  const creerPersonnel = async (e) => {
    e.preventDefault();
    setErreur("");
    if (!nom.trim() || !telephone.trim()) { setErreur("Nom et numéro requis"); return; }

    setEnvoiEnCours(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/api/personnel`, {
        method: "POST",
        headers,
        body: JSON.stringify({ nom, telephone }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErreur(data.error || `Erreur ${res.status} du serveur`);
        setEnvoiEnCours(false);
        return;
      }

      const data = await res.json();
      setDernierCree(data);
      setNom(""); setTelephone("");
      charger();
    } catch {
      setErreur("Impossible de contacter le serveur (vérifiez VITE_API_URL et la connexion)");
    }
    setEnvoiEnCours(false);
  };

  const retirerPersonnel = async (id) => {
    if (!confirm("Retirer ce membre du personnel ? Il ne pourra plus se connecter.")) return;
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/personnel/${id}`, { method: "DELETE", headers });
    if (res.ok) charger();
  };

  return (
    <div>
      <h1>Personnel</h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
        Le personnel peut consulter toutes les boutiques, ajouter et modifier des produits.
        Il ne peut jamais supprimer un produit ni une boutique.
      </p>

      <form onSubmit={creerPersonnel} style={{ background: "#fff", borderRadius: 10, padding: 16, maxWidth: 420, display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        <h3 style={{ margin: 0 }}>Ajouter un membre</h3>
        {erreur && <p style={{ color: "red", fontSize: 13 }}>{erreur}</p>}
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom complet" required />
        <input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Numéro WhatsApp" required />
        <button type="submit" disabled={envoiEnCours} style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "10px 0", fontWeight: 600 }}>
          {envoiEnCours ? "Création..." : "Créer le compte"}
        </button>
      </form>

      {dernierCree && (
        <div style={{ background: "#FFF8F2", border: "1px solid #F5720C66", borderRadius: 10, padding: 16, maxWidth: 420, marginBottom: 24 }}>
          <p style={{ fontWeight: 700, margin: "0 0 8px" }}>Compte créé pour {dernierCree.nom}</p>
          {dernierCree.lien ? (
            <>
              <p style={{ fontSize: 12, color: "#666", margin: "0 0 8px" }}>
                Envoyez ce lien à {dernierCree.nom} sur WhatsApp — en cliquant dessus, il entrera son numéro puis
                choisira son mot de passe. Ce lien est permanent et reste disponible dans la liste ci-dessous.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input readOnly value={dernierCree.lien} style={{ flex: 1, fontSize: 11 }} onFocus={(e) => e.target.select()} />
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(dernierCree.lien)}
                  style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "0 12px", fontWeight: 600 }}
                >
                  Copier
                </button>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 12, color: "red", margin: 0 }}>{dernierCree.avertissement}</p>
          )}
        </div>
      )}

      {erreurListe && (
        <div style={{ background: "#fff", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <p style={{ color: "red", margin: "0 0 8px" }}>{erreurListe}</p>
          <button onClick={charger} style={{ color: "#F5720C", background: "none", border: "none", fontWeight: 600 }}>Réessayer</button>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden" }}>
        {!erreurListe && personnel.length === 0 && <p style={{ padding: 16, color: "#999" }}>Aucun membre du personnel pour l'instant.</p>}
        {personnel.map((p) => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderBottom: "1px solid #eee" }}>
            <div>
              <strong>{p.nom}</strong>
              <div style={{ fontSize: 12, color: "#7A7A7A" }}>{p.telephone} — {p.email}</div>
              {resume[p.id] && (
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  📅 <strong>{resume[p.id].jours_mois}</strong> jour{resume[p.id].jours_mois > 1 ? "s" : ""} ce mois
                  {resume[p.id].non_cloturees > 0 && (
                    <span style={{ color: "#D32F2F" }}> · {resume[p.id].non_cloturees} non clôturé{resume[p.id].non_cloturees > 1 ? "s" : ""}</span>
                  )}
                </div>
              )}
              <Link to={`/personnel/${p.id}`} style={{ fontSize: 12, color: "#F5720C", fontWeight: 700 }}>
                Voir les jours de travail →
              </Link>
              {p.lien && (
                <div>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(p.lien); setLienCopie(p.id); setTimeout(() => setLienCopie(null), 2000); }}
                    style={{ fontSize: 12, color: "#1B1B1B", background: "none", border: "none", padding: 0, marginTop: 4, cursor: "pointer", textDecoration: "underline" }}
                  >
                    {lienCopie === p.id ? "✓ Lien copié" : "Copier son lien (permanent)"}
                  </button>
                </div>
              )}
            </div>
            <button style={{ color: "red" }} onClick={() => retirerPersonnel(p.id)}>Retirer</button>
          </div>
        ))}
      </div>
    </div>
  );
}
