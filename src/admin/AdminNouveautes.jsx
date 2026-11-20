// Nouveautés (statuts de 48 h) : l'admin publie au nom de TonaBk et peut supprimer n'importe quelle nouveauté.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";
import { reduireImage } from "../lib/image";

async function enTetes(json = true) {
  const { data: { session } } = await supabase.auth.getSession();
  const h = { Authorization: `Bearer ${session?.access_token}` };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

const ilYa = (iso) => {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  return min < 60 ? `il y a ${Math.max(1, min)} min` : `il y a ${Math.floor(min / 60)} h`;
};
const expire = (iso) => {
  const min = Math.floor((new Date(iso).getTime() - Date.now()) / 60000);
  return min <= 0 ? "expirée" : min < 60 ? `expire dans ${min} min` : `expire dans ${Math.floor(min / 60)} h`;
};

const MAX_PHOTOS = 5;

export default function AdminNouveautes() {
  const [liste, setListe] = useState([]);
  const [photos, setPhotos] = useState([]); // [{ fichier, apercu }] — 5 maximum
  const [texte, setTexte] = useState("");
  const [boutiques, setBoutiques] = useState([]);
  const [boutiqueId, setBoutiqueId] = useState(""); // vide = publié au nom de TonaBk
  const [rechercheBoutique, setRechercheBoutique] = useState("");
  const [articles, setArticles] = useState(null); // articles de la boutique choisie (null = pas de boutique / chargement)
  const [rechercheArticle, setRechercheArticle] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");

  const charger = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/nouveautes`);
      if (res.ok) setListe(await res.json());
      else setErreur(res.status === 404 ? "Route des nouveautés introuvable : redéployez le backend." : `Erreur ${res.status}`);
    } catch {
      setErreur("Impossible de contacter le serveur");
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/boutiques/admin/toutes`, { headers: await enTetes(false) });
        if (res.ok) setBoutiques((await res.json()).filter((b) => b.statut === "actif"));
      } catch { /* la liste restera vide : on publie alors au nom de TonaBk */ }
    })();
  }, []);
  // Articles de la boutique choisie
  useEffect(() => {
    setArticles(null); setRechercheArticle("");
    // on retire les photos d'articles de l'ancienne boutique
    setPhotos((prev) => prev.filter((p) => !p.produitId));
    if (!boutiqueId) return;
    let annule = false;
    fetch(`${API_URL}/api/produits?boutique_id=${encodeURIComponent(boutiqueId)}`)
      .then((r) => r.json()).then((d) => { if (!annule) setArticles(Array.isArray(d) ? d : []); })
      .catch(() => { if (!annule) setArticles([]); });
    return () => { annule = true; };
  }, [boutiqueId]);

  const photoArticle = (a) => (Array.isArray(a.photos) && a.photos[0]) || a.photo_url || null;
  const basculerArticle = (a) => {
    const deja = photos.findIndex((p) => p.produitId === a.id);
    if (deja >= 0) return retirerPhoto(deja);
    const url = photoArticle(a);
    if (!url) return setErreur("Cet article n'a pas de photo");
    if (photos.length >= MAX_PHOTOS) return setErreur(`${MAX_PHOTOS} photos maximum par nouveauté`);
    setErreur("");
    setPhotos((prev) => [...prev, { url, apercu: url, produitId: a.id }]);
    if (!texte.trim()) setTexte(`${a.nom}${a.prix ? ` — ${a.prix} ${a.devise || "USD"}` : ""}`.slice(0, 200));
  };

  const apercusRef = useRef([]);
  apercusRef.current = photos.filter((p) => p.fichier).map((p) => p.apercu);
  useEffect(() => () => { apercusRef.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const choisirPhotos = (e) => {
    const fichiers = Array.from(e.target.files || []);
    e.target.value = "";
    if (!fichiers.length) return;
    const place = MAX_PHOTOS - photos.length;
    setErreur(fichiers.length > place ? `${MAX_PHOTOS} photos maximum par nouveauté` : "");
    setPhotos((prev) => [...prev, ...fichiers.slice(0, place).map((fichier) => ({ fichier, apercu: URL.createObjectURL(fichier) }))]);
  };
  const retirerPhoto = (idx) => {
    setPhotos((prev) => { if (prev[idx]?.fichier) URL.revokeObjectURL(prev[idx].apercu); return prev.filter((_, k) => k !== idx); });
    setErreur("");
  };

  const publier = async (e) => {
    e.preventDefault();
    setErreur("");
    setMessage("");
    if (photos.length === 0) return setErreur("Choisissez au moins une photo");
    setEnvoi(true);
    try {
      const urls = [];
      for (const { fichier, url } of photos) {
        if (url) { urls.push(url); continue; } // photo d'un article : déjà en ligne
        const formData = new FormData();
        formData.append("photo", await reduireImage(fichier));
        const up = await fetch(`${API_URL}/api/upload/photo-nouveaute`, { method: "POST", headers: await enTetes(false), body: formData });
        const dataUp = await up.json().catch(() => ({}));
        if (!up.ok) throw new Error(dataUp.error || "Échec de l'envoi d'une photo");
        urls.push(dataUp.url);
      }

      const res = await fetch(`${API_URL}/api/nouveautes`, {
        method: "POST", headers: await enTetes(), body: JSON.stringify({ photos: urls, texte, ...(boutiqueId ? { boutique_id: boutiqueId } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Échec de la publication");

      setMessage(`Nouveauté publiée pour 48 h${boutiqueId ? " au nom de la boutique choisie" : ""}.`);
      photos.forEach((p) => p.fichier && URL.revokeObjectURL(p.apercu)); setPhotos([]); setTexte("");
      charger();
    } catch (err) {
      setErreur(err.message || "Erreur de connexion");
    }
    setEnvoi(false);
  };

  const supprimer = async (id) => {
    if (!window.confirm("Supprimer cette nouveauté ?")) return;
    const res = await fetch(`${API_URL}/api/nouveautes/${id}`, { method: "DELETE", headers: await enTetes() });
    if (res.ok) setListe((prev) => prev.filter((n) => n.id !== id));
    else setErreur("Impossible de supprimer");
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <h1>Mali mupya</h1>
      <p style={{ fontSize: 13, color: "#666" }}>Statuts visibles 48 h dans le menu de l'application. Choisissez la boutique à laquelle la nouveauté appartient (son nom et son WhatsApp s'afficheront), ou publiez au nom de TonaBk. Les commerçants peuvent aussi en publier ; vous pouvez supprimer n'importe laquelle.</p>

      <form onSubmit={publier} style={{ background: "#fff", borderRadius: 12, padding: 16, marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Publier une nouveauté</h3>
        <input value={rechercheBoutique} onChange={(e) => setRechercheBoutique(e.target.value)} placeholder={`Chercher une boutique (${boutiques.length} boutiques)`}
          style={{ border: "1px solid #ddd", borderRadius: 6, padding: 10, fontSize: 14 }} />
        <select value={boutiqueId} onChange={(e) => setBoutiqueId(e.target.value)} style={{ border: "1px solid #ddd", borderRadius: 6, padding: 10, fontSize: 14 }}>
          <option value="">Au nom de TonaBk (sans boutique)</option>
          {boutiques
            .filter((b) => b.id === boutiqueId || !rechercheBoutique.trim() || `${b.nom} ${b.ville || ""} ${b.quartier || ""}`.toLowerCase().includes(rechercheBoutique.trim().toLowerCase()))
            .map((b) => <option key={b.id} value={b.id}>{b.nom}{b.ville ? ` (${b.ville})` : ""}</option>)}
        </select>

        {boutiqueId && (
          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
            <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700 }}>Articles de cette boutique <span style={{ fontWeight: 400, color: "#999" }}>— touchez pour choisir ceux à mettre en Mali mupya</span></p>
            {articles === null && <p style={{ margin: 0, fontSize: 12, color: "#999" }}>Chargement des articles…</p>}
            {articles && articles.length === 0 && <p style={{ margin: 0, fontSize: 12, color: "#999" }}>Aucun article dans cette boutique. Vous pouvez ajouter vos propres photos ci-dessous.</p>}
            {articles && articles.length > 0 && (
              <>
                <input value={rechercheArticle} onChange={(e) => setRechercheArticle(e.target.value)} placeholder="Chercher un article"
                  style={{ width: "100%", boxSizing: "border-box", border: "1px solid #ddd", borderRadius: 6, padding: 8, fontSize: 13, marginBottom: 8 }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, maxHeight: 300, overflowY: "auto" }}>
                  {articles
                    .filter((a) => !rechercheArticle.trim() || (a.nom || "").toLowerCase().includes(rechercheArticle.trim().toLowerCase()))
                    .map((a) => {
                      const choisi = photos.some((p) => p.produitId === a.id);
                      const img = a.photo_thumb_url || photoArticle(a);
                      return (
                        <button type="button" key={a.id} onClick={() => basculerArticle(a)}
                          style={{ position: "relative", padding: 0, border: choisi ? "3px solid #F5720C" : "1px solid #eee", borderRadius: 8, background: "#fff", cursor: "pointer", overflow: "hidden", textAlign: "left" }}>
                          {img ? <img src={img} alt="" loading="lazy" style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }} />
                               : <div style={{ aspectRatio: "1 / 1", background: "#f3f3f3" }} />}
                          <div style={{ fontSize: 10, padding: "3px 4px", lineHeight: 1.2, height: 26, overflow: "hidden" }}>{a.nom}</div>
                          {choisi && <span style={{ position: "absolute", top: 3, right: 3, background: "#F5720C", color: "#fff", borderRadius: "50%", width: 18, height: 18, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</span>}
                        </button>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {photos.map((p, idx) => (
            <div key={p.apercu} style={{ position: "relative", aspectRatio: "1 / 1" }}>
              <img src={p.apercu} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
              <button type="button" onClick={() => retirerPhoto(idx)} aria-label="Retirer"
                style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.7)", color: "#fff" }}>×</button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label style={{ aspectRatio: "1 / 1", border: "2px dashed #F5720C66", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: "#F5720C", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              {photos.length === 0 ? "Ajouter des photos" : "Ajouter"}
              <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={choisirPhotos} />
            </label>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 11, color: "#999" }}>{photos.length}/{MAX_PHOTOS} photos</p>
        <textarea value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={200} rows={2} placeholder="Texte (optionnel)"
          style={{ border: "1px solid #ddd", borderRadius: 6, padding: 10, fontFamily: "inherit", fontSize: 14 }} />
        {erreur && <p style={{ color: "red", fontSize: 13, margin: 0 }}>{erreur}</p>}
        {message && <p style={{ color: "#2E7D32", fontSize: 13, margin: 0 }}>{message}</p>}
        <button type="submit" disabled={envoi || photos.length === 0} style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "10px 0", fontWeight: 600, opacity: envoi || photos.length === 0 ? 0.5 : 1 }}>
          {envoi ? "Publication..." : "Publier (48 h)"}
        </button>
      </form>

      <h3>Nouveautés actives ({liste.length})</h3>
      <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden" }}>
        {liste.length === 0 && <p style={{ padding: 16, color: "#999", margin: 0 }}>Aucune nouveauté active.</p>}
        {liste.map((n) => (
          <div key={n.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: 12, borderBottom: "1px solid #eee" }}>
            <img src={n.photo_url} alt="" style={{ width: 52, height: 52, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ fontSize: 13 }}>{n.auteur_nom}</strong>
              <div style={{ fontSize: 12, color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.texte || "Sans texte"}</div>
              <div style={{ fontSize: 11, color: "#999" }}>{(n.photos?.length || 1)} photo{(n.photos?.length || 1) > 1 ? "s" : ""} · {ilYa(n.created_at)} · {expire(n.expire_le)}</div>
            </div>
            <button onClick={() => supprimer(n.id)} style={{ color: "red", background: "none", border: "none", fontSize: 13 }}>Supprimer</button>
          </div>
        ))}
      </div>
    </div>
  );
}
