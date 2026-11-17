// Liens directs vers chaque rayon (type de produits) : à copier ou envoyer sur WhatsApp à un client.
import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";

const ORANGE = "#F5720C";
const bouton = (plein) => ({
  padding: "6px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
  border: `1px solid ${plein ? "#25D366" : ORANGE}`, background: plein ? "#25D366" : "#fff", color: plein ? "#fff" : ORANGE,
});

export default function AdminLiens() {
  const [categories, setCategories] = useState([]);
  const [categorieId, setCategorieId] = useState("");
  const [rayons, setRayons] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [copie, setCopie] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/api/categories`).then((r) => r.json()).then((d) => {
      const liste = Array.isArray(d) ? d : [];
      setCategories(liste);
      if (liste[0]) setCategorieId(String(liste[0].id));
    }).catch(() => setErreur("Impossible de charger les catégories"));
  }, []);

  useEffect(() => {
    if (!categorieId) return;
    setRayons([]); setErreur("");
    fetch(`${API_URL}/api/sous-categories?categorie_id=${encodeURIComponent(categorieId)}`)
      .then((r) => r.json()).then((d) => setRayons(Array.isArray(d) ? d : []))
      .catch(() => setErreur("Impossible de charger les rayons"));
  }, [categorieId]);

  const lien = (id) => `${API_URL}/partage/type/${id}`;
  const copier = async (r) => {
    try { await navigator.clipboard.writeText(lien(r.id)); setCopie(r.id); setTimeout(() => setCopie(null), 1800); }
    catch { window.prompt("Copiez ce lien :", lien(r.id)); }
  };
  const envoyer = (r) =>
    window.open(`https://wa.me/?text=${encodeURIComponent(`Voici nos ${r.nom.toLowerCase()} sur TonaBk :\n${lien(r.id)}`)}`, "_blank");

  const q = recherche.trim().toLowerCase();
  const racines = rayons.filter((r) => !r.parent_id);
  const lignes = [];
  racines.forEach((r) => {
    lignes.push({ ...r, niveau: 0 });
    rayons.filter((e) => e.parent_id === r.id).forEach((e) => lignes.push({ ...e, niveau: 1, parent: r.nom }));
  });
  const visibles = q ? lignes.filter((l) => l.nom.toLowerCase().includes(q) || (l.parent || "").toLowerCase().includes(q)) : lignes;

  return (
    <div>
      <h1>Liens à partager</h1>
      <p style={{ fontSize: 13, color: "#666", maxWidth: 620 }}>
        Un client vous demande « les chemises » ? Copiez le lien du rayon et envoyez-le-lui sur WhatsApp : il verra une photo
        et arrivera directement sur tous les articles de ce rayon.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        <select value={categorieId} onChange={(e) => setCategorieId(e.target.value)} style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd" }}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.icone || ""} {c.nom}</option>)}
        </select>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Chercher un rayon (ex. chemise)"
          style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd", minWidth: 220 }} />
      </div>
      {erreur && <p style={{ color: "red", fontSize: 13 }}>{erreur}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 620 }}>
        {visibles.map((r) => (
          <div key={r.id} style={{ background: "#fff", borderRadius: 8, padding: "8px 10px", marginLeft: r.niveau ? 18 : 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: r.niveau ? 500 : 700 }}>
              {r.icone || ""} {r.nom}{r.parent && !q ? "" : r.parent ? <span style={{ color: "#999" }}> · {r.parent}</span> : null}
            </span>
            <button style={bouton(false)} onClick={() => copier(r)}>{copie === r.id ? "Copié ✓" : "Copier le lien"}</button>
            <button style={bouton(true)} onClick={() => envoyer(r)}>WhatsApp</button>
          </div>
        ))}
        {!erreur && visibles.length === 0 && <p style={{ fontSize: 13, color: "#888" }}>Aucun rayon trouvé.</p>}
      </div>
    </div>
  );
}
