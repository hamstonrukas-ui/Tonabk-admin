import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";

const fmt = (n, devise = "USD") => Number(n).toLocaleString("fr-FR") + " " + devise;
const chiffres = (t) => (t || "").replace(/[^\d]/g, "");

export default function AdminReperes() {
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  const chercher = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    setChargement(true);
    setErreur("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/reperes/chercher?q=${encodeURIComponent(q.trim())}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(res.status === 404 ? "Route introuvable : redéployez le backend." : data.error || `Erreur ${res.status}`);
      }
      setResultats(data);
    } catch (err) {
      setErreur(err.message || "Connexion au serveur impossible.");
      setResultats(null);
    }
    setChargement(false);
  };

  return (
    <div>
      <h1>Repères</h1>
      <p style={{ fontSize: 13, color: "#666", maxWidth: 560 }}>
        Entrez le numéro de repère d'un article (ex : <strong>1042</strong>) ou un mot (nom de l'article, du fournisseur, contact)
        pour retrouver à quelle boutique il appartient et d'où vient la photo.
      </p>

      <form onSubmit={chercher} style={{ display: "flex", gap: 8, margin: "12px 0", maxWidth: 480 }}>
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Numéro de repère ou mot…" autoFocus
          style={{ flex: 1, padding: 10, borderRadius: 6, border: "1px solid #ddd" }}
        />
        <button type="submit" disabled={chargement} style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "0 16px", fontWeight: 600, cursor: "pointer" }}>
          {chargement ? "…" : "Chercher"}
        </button>
      </form>

      {erreur && <p style={{ color: "red", fontSize: 13 }}>{erreur}</p>}
      {resultats && resultats.length === 0 && <p style={{ color: "#999" }}>Aucun article trouvé pour « {q} ».</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
        {(resultats || []).map((r) => {
          const tel = chiffres(r.boutique?.telephone);
          return (
            <div key={r.produit_id} style={{ background: "#fff", borderRadius: 10, padding: 12, display: "flex", gap: 12, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
              {r.produit.photo_url ? (
                <img src={r.produit.photo_url} alt="" style={{ width: 84, height: 84, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 84, height: 84, borderRadius: 8, background: "#eee", flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                <div style={{ color: "#F5720C", fontWeight: 800 }}>Repère #{r.code}</div>
                <strong>{r.produit.nom}</strong> — {fmt(r.produit.prix, r.produit.devise)}

                <div style={{ marginTop: 6 }}>
                  <span style={{ color: "#7A7A7A" }}>Boutique : </span>
                  <strong>{r.boutique?.nom || "—"}</strong>
                  {r.boutique?.ville ? ` (${r.boutique.ville})` : ""}
                </div>
                {tel && (
                  <div>
                    <span style={{ color: "#7A7A7A" }}>Contact : </span>
                    <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer" style={{ color: "#2E7D32", fontWeight: 600 }}>
                      {r.boutique.telephone} (WhatsApp)
                    </a>
                  </div>
                )}

                <div style={{ marginTop: 6, background: "#FFF7F0", borderRadius: 6, padding: "6px 8px" }}>
                  <div><span style={{ color: "#7A7A7A" }}>Source de la photo : </span>{r.fournisseur_nom || <em style={{ color: "#aaa" }}>non renseignée</em>}</div>
                  {r.fournisseur_contact && <div><span style={{ color: "#7A7A7A" }}>Contact source : </span>{r.fournisseur_contact}</div>}
                  {r.note && <div><span style={{ color: "#7A7A7A" }}>Note : </span>{r.note}</div>}
                </div>

                {r.boutique?.id && (
                  <Link to={`/boutiques/${r.boutique.id}/produits`} style={{ display: "inline-block", marginTop: 8, color: "#F5720C", fontWeight: 600 }}>
                    Ouvrir la boutique et modifier →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
