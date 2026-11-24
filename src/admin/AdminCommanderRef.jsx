import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` };
}

// Accepte la référence seule (8d1e0b3e) ou tout le message WhatsApp collé : on en tire la référence.
function extraireRef(texte) {
  const t = String(texte || "").trim();
  const m = t.match(/r[ée]f\.?\s*commande\s*:?\s*#?\s*([0-9a-f]{6,32})/i);
  if (m) return m[1];
  return t.split(/\s+/).pop().replace(/[^0-9a-f]/gi, "");
}

const STATUTS = {
  brouillon: "Brouillon (le client n'a pas encore donné son adresse)",
  en_attente: "En attente",
  acceptee: "Acceptée",
  en_route: "En route",
  livree: "Livrée",
  annulee: "Annulée",
};

export default function AdminCommandeRef() {
  const [saisie, setSaisie] = useState("");
  const [resultats, setResultats] = useState(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  const chercher = async (e) => {
    e.preventDefault();
    setErreur("");
    setResultats(null);
    const ref = extraireRef(saisie);
    if (ref.length < 6) { setErreur("Tapez la référence (au moins 6 caractères) ou collez le message du client."); return; }
    setChargement(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/api/livraisons/ref/${encodeURIComponent(ref)}`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setErreur(data.error || `Erreur ${res.status} du serveur`);
      else setResultats(data);
    } catch {
      setErreur("Impossible de contacter le serveur (vérifiez la connexion)");
    }
    setChargement(false);
  };

  return (
    <div>
      <h1>Chercher une commande</h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
        Tapez la référence du message WhatsApp du client (ex. 8d1e0b3e), ou collez tout son message : le produit s'affiche avec sa photo.
      </p>

      <form onSubmit={chercher} style={{ background: "#fff", borderRadius: 10, padding: 16, maxWidth: 480, display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Référence, ex. 8d1e0b3e"
          autoCapitalize="none"
          autoCorrect="off"
          style={{ fontSize: 16, padding: 10 }}
        />
        <button type="submit" disabled={chargement} style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "10px 0", fontWeight: 600 }}>
          {chargement ? "Recherche..." : "Chercher"}
        </button>
        {erreur && <p style={{ color: "red", fontSize: 13, margin: 0 }}>{erreur}</p>}
      </form>

      {resultats && resultats.length === 0 && (
        <p style={{ color: "#999" }}>Aucune commande trouvée avec cette référence.</p>
      )}

      {(resultats || []).map((r) => (
        <div key={r.reference + r.date} style={{ background: "#fff", borderRadius: 10, padding: 16, maxWidth: 480, marginBottom: 16 }}>
          {r.photo ? (
            <img src={r.photo} alt={r.nom_produit} loading="lazy" style={{ width: "100%", maxHeight: 360, objectFit: "contain", borderRadius: 8, background: "#f5f5f5", marginBottom: 12 }} />
          ) : (
            <p style={{ fontSize: 12, color: "#999", margin: "0 0 12px" }}>Pas de photo pour ce produit.</p>
          )}
          <p style={{ fontWeight: 700, fontSize: 18, margin: "0 0 4px" }}>{r.nom_produit}</p>
          <p style={{ margin: "0 0 4px", color: "#F5720C", fontWeight: 700 }}>{Number(r.prix).toLocaleString("fr-FR")} {r.devise}</p>
          {r.boutique && <p style={{ margin: "0 0 4px", fontSize: 14 }}>Boutique : <strong>{r.boutique}</strong></p>}
          <p style={{ margin: "0 0 4px", fontSize: 13, color: "#666" }}>
            Réf. {r.reference} — {STATUTS[r.statut] || r.statut} — {new Date(r.date).toLocaleString("fr-FR")}
          </p>
          {(r.client_nom || r.client_telephone || r.client_adresse) && (
            <p style={{ margin: "8px 0 0", fontSize: 13 }}>
              Client : {r.client_nom} {r.client_telephone && `— ${r.client_telephone}`}
              {r.client_adresse && <><br />Adresse : {r.client_adresse}</>}
            </p>
          )}
          {r.lien && (
            <a href={r.lien} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: 13, color: "#F5720C", fontWeight: 700 }}>
              Ouvrir la fiche du produit →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
