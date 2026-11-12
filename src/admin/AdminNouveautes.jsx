// Nouveautés (statuts de 48 h) : l'admin publie au nom de TonaBk et peut supprimer n'importe quelle nouveauté.
import { useCallback, useEffect, useState } from "react";
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

export default function AdminNouveautes() {
  const [liste, setListe] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [apercu, setApercu] = useState(null);
  const [texte, setTexte] = useState("");
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
  useEffect(() => () => { if (apercu) URL.revokeObjectURL(apercu); }, [apercu]);

  const publier = async (e) => {
    e.preventDefault();
    setErreur("");
    setMessage("");
    if (!photo) return setErreur("Choisissez une photo");
    setEnvoi(true);
    try {
      const formData = new FormData();
      formData.append("photo", await reduireImage(photo));
      const up = await fetch(`${API_URL}/api/upload/photo-nouveaute`, { method: "POST", headers: await enTetes(false), body: formData });
      const dataUp = await up.json().catch(() => ({}));
      if (!up.ok) throw new Error(dataUp.error || "Échec de l'envoi de la photo");

      const res = await fetch(`${API_URL}/api/nouveautes`, {
        method: "POST", headers: await enTetes(), body: JSON.stringify({ photo_url: dataUp.url, texte }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Échec de la publication");

      setMessage("Nouveauté publiée pour 48 h.");
      setPhoto(null); setApercu(null); setTexte("");
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
      <h1>Nouveautés</h1>
      <p style={{ fontSize: 13, color: "#666" }}>Statuts visibles 48 h dans le menu de l'application. Les commerçants peuvent aussi en publier ; vous pouvez supprimer n'importe laquelle.</p>

      <form onSubmit={publier} style={{ background: "#fff", borderRadius: 12, padding: 16, marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Publier au nom de TonaBk</h3>
        <label style={{ display: "block", cursor: "pointer" }}>
          {apercu ? (
            <img src={apercu} alt="" style={{ width: "100%", maxHeight: 280, objectFit: "contain", background: "#000", borderRadius: 8 }} />
          ) : (
            <div style={{ border: "2px dashed #F5720C66", borderRadius: 8, padding: "28px 0", textAlign: "center", color: "#F5720C", fontWeight: 600, fontSize: 14 }}>Choisir une photo</div>
          )}
          <input type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { setPhoto(f); setApercu(URL.createObjectURL(f)); } }} />
        </label>
        <textarea value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={200} rows={2} placeholder="Texte (optionnel)"
          style={{ border: "1px solid #ddd", borderRadius: 6, padding: 10, fontFamily: "inherit", fontSize: 14 }} />
        {erreur && <p style={{ color: "red", fontSize: 13, margin: 0 }}>{erreur}</p>}
        {message && <p style={{ color: "#2E7D32", fontSize: 13, margin: 0 }}>{message}</p>}
        <button type="submit" disabled={envoi || !photo} style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "10px 0", fontWeight: 600, opacity: envoi || !photo ? 0.5 : 1 }}>
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
              <div style={{ fontSize: 11, color: "#999" }}>{ilYa(n.created_at)} · {expire(n.expire_le)}</div>
            </div>
            <button onClick={() => supprimer(n.id)} style={{ color: "red", background: "none", border: "none", fontSize: 13 }}>Supprimer</button>
          </div>
        ))}
      </div>
    </div>
  );
}
