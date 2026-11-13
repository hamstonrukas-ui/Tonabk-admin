// Kisakoshi (valises) : l'admin en crée pour la boutique de son choix et peut retirer n'importe lequel.
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
  if (min < 60) return `il y a ${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `il y a ${h} h` : `il y a ${Math.floor(h / 24)} j`;
};
const expire = (iso) => {
  const min = Math.floor((new Date(iso).getTime() - Date.now()) / 60000);
  if (min <= 0) return "expiré";
  if (min < 60) return `expire dans ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `expire dans ${h} h` : `expire dans ${Math.floor(h / 24)} j`;
};

const MAX_PHOTOS = 10;
const formaterPrix = (p, d) => `${Number(p).toLocaleString("fr-FR")} ${d}`;

export default function AdminKisakoshi() {
  const [boutiques, setBoutiques] = useState([]);
  const [boutiqueId, setBoutiqueId] = useState("");
  const [contenu, setContenu] = useState("");
  const [prix, setPrix] = useState("");
  const [devise, setDevise] = useState("USD");
  const [liste, setListe] = useState([]);
  const [photos, setPhotos] = useState([]); // [{ fichier, apercu }] — 5 maximum
  const [texte, setTexte] = useState(""); // message
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");

  const charger = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/kisakoshi`);
      if (res.ok) setListe(await res.json());
      else setErreur(res.status === 404 ? "Route Kisakoshi introuvable : redéployez le backend." : `Erreur ${res.status}`);
    } catch {
      setErreur("Impossible de contacter le serveur");
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/boutiques/admin/toutes`, { headers: await enTetes(false) });
        if (res.ok) setBoutiques(await res.json());
      } catch { /* la liste des boutiques restera vide */ }
    })();
  }, []);
  const apercusRef = useRef([]);
  apercusRef.current = photos.map((p) => p.apercu);
  useEffect(() => () => { apercusRef.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const choisirPhotos = (e) => {
    const fichiers = Array.from(e.target.files || []);
    e.target.value = "";
    if (!fichiers.length) return;
    const place = MAX_PHOTOS - photos.length;
    setErreur(fichiers.length > place ? `${MAX_PHOTOS} photos maximum par Kisakoshi` : "");
    setPhotos((prev) => [...prev, ...fichiers.slice(0, place).map((fichier) => ({ fichier, apercu: URL.createObjectURL(fichier) }))]);
  };
  const retirerPhoto = (idx) => {
    setPhotos((prev) => { URL.revokeObjectURL(prev[idx].apercu); return prev.filter((_, k) => k !== idx); });
    setErreur("");
  };

  const publier = async (e) => {
    e.preventDefault();
    setErreur("");
    setMessage("");
    if (!boutiqueId) return setErreur("Choisissez la boutique concernée");
    if (!contenu.trim()) return setErreur("Écrivez le contenu de la valise");
    if (!(Number(prix) > 0)) return setErreur("Indiquez le prix");
    if (photos.length === 0) return setErreur("Choisissez au moins une photo");
    setEnvoi(true);
    try {
      const urls = [];
      for (const { fichier } of photos) {
        const formData = new FormData();
        formData.append("photo", await reduireImage(fichier));
        const up = await fetch(`${API_URL}/api/upload/photo-nouveaute`, { method: "POST", headers: await enTetes(false), body: formData });
        const dataUp = await up.json().catch(() => ({}));
        if (!up.ok) throw new Error(dataUp.error || "Échec de l'envoi d'une photo");
        urls.push(dataUp.url);
      }

      const res = await fetch(`${API_URL}/api/kisakoshi`, {
        method: "POST", headers: await enTetes(), body: JSON.stringify({ photos: urls, contenu, prix: Number(prix), devise, message: texte, boutique_id: boutiqueId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Échec de la publication");

      setMessage("Kisakoshi publié pour 7 jours.");
      photos.forEach((p) => URL.revokeObjectURL(p.apercu)); setPhotos([]); setTexte(""); setContenu(""); setPrix("");
      charger();
    } catch (err) {
      setErreur(err.message || "Erreur de connexion");
    }
    setEnvoi(false);
  };

  const supprimer = async (id) => {
    if (!window.confirm("Retirer ce Kisakoshi ?")) return;
    const res = await fetch(`${API_URL}/api/kisakoshi/${id}`, { method: "DELETE", headers: await enTetes() });
    if (res.ok) setListe((prev) => prev.filter((n) => n.id !== id));
    else setErreur("Impossible de supprimer");
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <h1>Kisakoshi</h1>
      <p style={{ fontSize: 13, color: "#666" }}>Les valises : plusieurs articles pour un seul prix, visibles 7 jours dans le menu de l'application. Les commerçants peuvent aussi en créer ; vous pouvez retirer n'importe lequel.</p>

      <form onSubmit={publier} style={{ background: "#fff", borderRadius: 12, padding: 16, marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Créer un Kisakoshi pour une boutique</h3>
        <select value={boutiqueId} onChange={(e) => setBoutiqueId(e.target.value)} style={{ border: "1px solid #ddd", borderRadius: 6, padding: 10, fontSize: 14 }}>
          <option value="">Choisir la boutique…</option>
          {boutiques.filter((b) => b.statut === "actif").map((b) => <option key={b.id} value={b.id}>{b.nom}{b.ville ? ` (${b.ville})` : ""}</option>)}
        </select>
        <input value={contenu} onChange={(e) => setContenu(e.target.value)} maxLength={200} placeholder="Contenu : ex. 2 pantalons + 3 jupes + 5 body"
          style={{ border: "1px solid #ddd", borderRadius: 6, padding: 10, fontSize: 14 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <input value={prix} onChange={(e) => setPrix(e.target.value)} type="number" min="0" step="any" placeholder="Prix de la valise"
            style={{ flex: 1, border: "1px solid #ddd", borderRadius: 6, padding: 10, fontSize: 14 }} />
          <select value={devise} onChange={(e) => setDevise(e.target.value)} style={{ border: "1px solid #ddd", borderRadius: 6, padding: 10 }}>
            <option value="USD">USD</option>
            <option value="CDF">CDF</option>
          </select>
        </div>
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
        <textarea value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={300} rows={2} placeholder="Message (optionnel) : tailles, état, livraison…"
          style={{ border: "1px solid #ddd", borderRadius: 6, padding: 10, fontFamily: "inherit", fontSize: 14 }} />
        {erreur && <p style={{ color: "red", fontSize: 13, margin: 0 }}>{erreur}</p>}
        {message && <p style={{ color: "#2E7D32", fontSize: 13, margin: 0 }}>{message}</p>}
        <button type="submit" disabled={envoi || photos.length === 0} style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "10px 0", fontWeight: 600, opacity: envoi || photos.length === 0 ? 0.5 : 1 }}>
          {envoi ? "Publication..." : "Publier le Kisakoshi"}
        </button>
      </form>

      <h3>Kisakoshi actifs ({liste.length})</h3>
      <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden" }}>
        {liste.length === 0 && <p style={{ padding: 16, color: "#999", margin: 0 }}>Aucun Kisakoshi actif.</p>}
        {liste.map((n) => (
          <div key={n.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: 12, borderBottom: "1px solid #eee" }}>
            <img src={n.photos?.[0]} alt="" style={{ width: 52, height: 52, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ fontSize: 13 }}>{n.auteur_nom}</strong>
              <div style={{ fontSize: 12, color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.contenu} — <strong>{formaterPrix(n.prix, n.devise)}</strong></div>
              <div style={{ fontSize: 11, color: "#999" }}>{(n.photos?.length || 1)} photo{(n.photos?.length || 1) > 1 ? "s" : ""} · {ilYa(n.created_at)} · {expire(n.expire_le)}</div>
            </div>
            <button onClick={() => supprimer(n.id)} style={{ color: "red", background: "none", border: "none", fontSize: 13 }}>Retirer</button>
          </div>
        ))}
      </div>
    </div>
  );
}
