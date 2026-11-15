// Vérifie que la photo de chaque produit s'ouvre vraiment, et liste celles qui sont cassées avec la cause.
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";

const TRANCHE = 100;
const ORANGE = "#F5720C";

export default function AdminPhotosCassees() {
  const [cassees, setCassees] = useState([]);
  const [traites, setTraites] = useState(0);
  const [total, setTotal] = useState(null);
  const [sansPhoto, setSansPhoto] = useState(0);
  const [baseR2, setBaseR2] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [fini, setFini] = useState(false);
  const [erreur, setErreur] = useState("");
  const arret = useRef(false);

  async function lancer() {
    setCassees([]); setTraites(0); setTotal(null); setSansPhoto(0); setErreur(""); setFini(false);
    arret.current = false;
    setEnCours(true);
    let debut = 0;
    try {
      while (debut !== null && !arret.current) {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${API_URL}/api/photos-verif?debut=${debut}&nb=${TRANCHE}`, {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(res.status === 404 ? "Route introuvable : redéployez le backend." : data.error || `Erreur ${res.status}`);
        setTotal(data.total); setBaseR2(data.base_r2);
        setTraites((n) => n + data.traites);
        setSansPhoto((n) => n + data.sans_photo);
        setCassees((prev) => [...prev, ...data.cassees]);
        debut = data.suivant;
      }
      if (!arret.current) setFini(true);
    } catch (err) {
      setErreur(err.message || "Connexion impossible");
    }
    setEnCours(false);
  }

  // Résumé par cause
  const causes = {};
  for (const c of cassees) causes[c.raison] = (causes[c.raison] || 0) + 1;

  return (
    <div>
      <h1>Photos cassées</h1>
      <p style={{ fontSize: 13, color: "#666", maxWidth: 620 }}>
        Teste l'adresse de la photo de chaque produit et indique pourquoi elle ne s'affiche pas.
      </p>

      {!enCours ? (
        <button onClick={lancer} style={{ background: ORANGE, color: "#fff", border: "none", borderRadius: 6, padding: "10px 16px", fontWeight: 600, cursor: "pointer" }}>
          Lancer la vérification
        </button>
      ) : (
        <button onClick={() => { arret.current = true; }} style={{ background: "#fff", color: ORANGE, border: `1px solid ${ORANGE}`, borderRadius: 6, padding: "10px 16px", fontWeight: 600, cursor: "pointer" }}>
          Arrêter
        </button>
      )}
      <span style={{ marginLeft: 12, fontSize: 13, color: "#666" }}>
        {traites}{total != null ? ` / ${total}` : ""} produits vérifiés
      </span>

      {erreur && <p style={{ color: "red", fontSize: 13 }}>{erreur}</p>}
      {baseR2 && <p style={{ fontSize: 11, color: "#999" }}>Stockage photos configuré : {baseR2}</p>}

      {(fini || cassees.length > 0) && (
        <div style={{ margin: "14px 0", background: "#fff", borderRadius: 10, padding: 14, maxWidth: 620, fontSize: 13 }}>
          <strong>{cassees.length === 0 && fini ? "Toutes les photos répondent correctement." : `${cassees.length} photo(s) cassée(s)`}</strong>
          {sansPhoto > 0 && <div style={{ color: "#666" }}>{sansPhoto} produit(s) sans photo.</div>}
          {Object.entries(causes).map(([raison, n]) => (
            <div key={raison} style={{ marginTop: 4 }}>• <strong>{n}</strong> — {raison}</div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 760 }}>
        {cassees.map((c, i) => (
          <div key={c.produit_id + i} style={{ background: "#fff", borderRadius: 8, padding: 10, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <span><strong>{c.nom}</strong> — {c.boutique || "boutique ?"}</span>
              {c.boutique_id && <Link to={`/boutiques/${c.boutique_id}/produits`} style={{ color: ORANGE, fontWeight: 600 }}>Ouvrir la boutique →</Link>}
            </div>
            <div style={{ color: "#C62828" }}>{c.statut > 0 ? `HTTP ${c.statut} · ` : ""}{c.raison}</div>
            <div style={{ color: "#999", wordBreak: "break-all" }}>{c.url}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
