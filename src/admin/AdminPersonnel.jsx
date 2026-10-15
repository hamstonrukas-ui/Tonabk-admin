import { useEffect, useState } from "react";
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

  async function charger() {
    setErreurListe("");
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/api/personnel`, { headers });
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
          <p style={{ fontSize: 13, margin: "0 0 4px" }}>
            Email de connexion : <strong>{dernierCree.email}</strong>
          </p>
          <p style={{ fontSize: 12, color: "#666", margin: 0 }}>
            Communiquez cet email à la personne. Pour le mot de passe, voyez avec vous pour le moment
            (la définition du mot de passe par WhatsApp arrive bientôt).
          </p>
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
            </div>
            <button style={{ color: "red" }} onClick={() => retirerPersonnel(p.id)}>Retirer</button>
          </div>
        ))}
      </div>
    </div>
  );
}
