import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";

async function fetchAvecDelai(url, options = {}, delaiMs = 15000) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), delaiMs);
  try {
    return await fetch(url, { ...options, signal: controleur.signal });
  } finally {
    clearTimeout(minuteur);
  }
}

export default function AdminToutesBoutiques() {
  const [boutiques, setBoutiques] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    async function charger() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetchAvecDelai(`${API_URL}/api/boutiques/admin/toutes`, {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (res.ok) setBoutiques(await res.json());
        else setErreur("Impossible de charger les boutiques.");
      } catch (err) {
        setErreur(err.name === "AbortError" ? "Le serveur met trop de temps à répondre." : "Connexion au serveur impossible.");
      }
    }
    charger();
  }, []);

  if (erreur) return <p style={{ color: "red" }}>{erreur}</p>;
  if (boutiques === null) return <p style={{ color: "#999" }}>Chargement...</p>;

  const filtrees = boutiques.filter((b) => b.nom.toLowerCase().includes(recherche.toLowerCase()));

  return (
    <div>
      <h1>Toutes les boutiques ({boutiques.length})</h1>
      <input
        value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher une boutique..."
        style={{ width: "100%", maxWidth: 320, padding: 8, margin: "12px 0", borderRadius: 6, border: "1px solid #ddd" }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtrees.map((b) => (
          <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", padding: 12, borderRadius: 8 }}>
            {b.logo_url ? (
              <img src={b.logo_url} alt={b.nom} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#F5720C", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                {b.nom.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <strong>{b.nom}</strong> {b.certifiee && "✔"}
              <div style={{ fontSize: 12, color: "#7A7A7A" }}>
                {[b.ville, b.commune, b.quartier].filter(Boolean).join(" — ")} · {b.categories?.nom || "Sans catégorie"} · {b.statut}
              </div>
            </div>
            <Link to={`/boutiques/${b.id}/produits`} style={{ background: "#F5720C", color: "#fff", padding: "6px 10px", borderRadius: 6, textDecoration: "none", fontSize: 13 }}>
              Gérer les produits
            </Link>
          </div>
        ))}
        {filtrees.length === 0 && <p style={{ color: "#999" }}>Aucune boutique trouvée</p>}
      </div>
    </div>
  );
                                            }
      
