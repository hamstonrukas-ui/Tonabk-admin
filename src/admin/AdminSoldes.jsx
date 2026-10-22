import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";
import { reduireImage } from "../lib/image";

const MAX_PHOTOS = 6;

async function authHeaders(json = true) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { Authorization: `Bearer ${session?.access_token}` };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

const fmt = (n, devise = "USD") => Number(n).toLocaleString("fr-FR") + " " + devise;

// datetime-local attend "YYYY-MM-DDTHH:mm" en heure locale
function versDatetimeLocal(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const videForm = {
  titre: "", description: "", prix_normal: "", prix_solde: "",
  devise: "USD", quantite: "", expire_le: "",
};

export default function AdminSoldes() {
  const [soldes, setSoldes] = useState([]);
  const [erreurListe, setErreurListe] = useState("");

  const [form, setForm] = useState(videForm);
  const [photos, setPhotos] = useState([]);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(videForm);
  const [editPhotos, setEditPhotos] = useState([]);
  const [editPhotosExistantes, setEditPhotosExistantes] = useState([]);
  const [editEnvoiEnCours, setEditEnvoiEnCours] = useState(false);
  const [editErreur, setEditErreur] = useState("");

  async function charger() {
    setErreurListe("");
    try {
      const res = await fetch(`${API_URL}/api/soldes`);
      if (res.ok) setSoldes(await res.json());
      else setErreurListe(`Erreur ${res.status} du serveur`);
    } catch {
      setErreurListe("Impossible de contacter le serveur");
    }
  }

  useEffect(() => { charger(); }, []);

  async function uploaderPhotos(fichiers) {
    const headers = await authHeaders(false);
    const urls = [];
    for (const fichier of fichiers) {
      const reduite = await reduireImage(fichier);
      const formData = new FormData();
      formData.append("photo", reduite);
      const res = await fetch(`${API_URL}/api/upload/photo-solde`, { method: "POST", headers, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de l'envoi d'une photo");
      urls.push(data.url);
    }
    return urls;
  }

  const creerSolde = async (e) => {
    e.preventDefault();
    setErreur("");
    if (!form.titre.trim() || !form.prix_normal || !form.prix_solde || !form.expire_le) {
      setErreur("Titre, prix normal, prix solde et date de fin sont requis");
      return;
    }

    setEnvoiEnCours(true);
    try {
      const urls = await uploaderPhotos(photos);
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/api/soldes`, {
        method: "POST", headers,
        body: JSON.stringify({
          ...form,
          prix_normal: Number(form.prix_normal),
          prix_solde: Number(form.prix_solde),
          quantite: Number(form.quantite) || 0,
          expire_le: new Date(form.expire_le).toISOString(),
          photos: urls,
          photo_url: urls[0] || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErreur(data.error || "Échec de la création"); setEnvoiEnCours(false); return; }

      setForm(videForm);
      setPhotos([]);
      charger();
    } catch (err) {
      setErreur(err.message || "Erreur de connexion");
    }
    setEnvoiEnCours(false);
  };

  const ouvrirEdition = (s) => {
    setEditId(s.id);
    setEditForm({
      titre: s.titre, description: s.description || "",
      prix_normal: s.prix_normal, prix_solde: s.prix_solde,
      devise: s.devise, quantite: s.quantite,
      expire_le: versDatetimeLocal(s.expire_le),
    });
    setEditPhotos([]);
    setEditPhotosExistantes(s.photos?.length ? s.photos : (s.photo_url ? [s.photo_url] : []));
    setEditErreur("");
  };

  const modifierSolde = async (e) => {
    e.preventDefault();
    setEditErreur("");
    setEditEnvoiEnCours(true);
    try {
      const urlsNouvelles = await uploaderPhotos(editPhotos);
      const toutesLesPhotos = [...editPhotosExistantes, ...urlsNouvelles];

      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/api/soldes/${editId}`, {
        method: "PUT", headers,
        body: JSON.stringify({
          ...editForm,
          prix_normal: Number(editForm.prix_normal),
          prix_solde: Number(editForm.prix_solde),
          quantite: Number(editForm.quantite) || 0,
          expire_le: new Date(editForm.expire_le).toISOString(),
          photos: toutesLesPhotos,
          photo_url: toutesLesPhotos[0] || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setEditErreur(data.error || "Échec de la modification"); setEditEnvoiEnCours(false); return; }

      setEditId(null);
      charger();
    } catch (err) {
      setEditErreur(err.message || "Erreur de connexion");
    }
    setEditEnvoiEnCours(false);
  };

  const supprimerSolde = async (id) => {
    if (!confirm("Supprimer ce solde ?")) return;
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/api/soldes/${id}`, { method: "DELETE", headers });
    if (res.ok) charger();
  };

  return (
    <div>
      <h1>Soldes</h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
        Offres liées au numéro WhatsApp central TonaBk (+243 855 841 999). Disparaissent
        automatiquement après la date de fin.
      </p>

      <form onSubmit={creerSolde} style={{ background: "#fff", borderRadius: 10, padding: 16, maxWidth: 440, display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        <h3 style={{ margin: 0 }}>Créer un solde</h3>
        {erreur && <p style={{ color: "red", fontSize: 13 }}>{erreur}</p>}

        <input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} placeholder="Titre de l'offre" required />
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={2} />

        <div style={{ display: "flex", gap: 8 }}>
          <input value={form.prix_normal} onChange={(e) => setForm({ ...form, prix_normal: e.target.value })} type="number" placeholder="Prix normal" required style={{ flex: 1 }} />
          <input value={form.prix_solde} onChange={(e) => setForm({ ...form, prix_solde: e.target.value })} type="number" placeholder="Prix solde" required style={{ flex: 1 }} />
          <select value={form.devise} onChange={(e) => setForm({ ...form, devise: e.target.value })}>
            <option value="USD">USD</option>
            <option value="CDF">CDF</option>
          </select>
        </div>

        <input value={form.quantite} onChange={(e) => setForm({ ...form, quantite: e.target.value })} type="number" placeholder="Quantité disponible" />

        <label style={{ fontSize: 12, color: "#666" }}>
          Date et heure de fin de l'offre
          <input value={form.expire_le} onChange={(e) => setForm({ ...form, expire_le: e.target.value })} type="datetime-local" required style={{ display: "block", width: "100%", marginTop: 4 }} />
        </label>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {photos.map((f, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img src={URL.createObjectURL(f)} alt="" style={{ width: 52, height: 52, borderRadius: 6, objectFit: "cover" }} />
              <button type="button" onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                style={{ position: "absolute", top: -6, right: -6, width: 16, height: 16, borderRadius: "50%", background: "#fff", border: "1px solid #ddd", fontSize: 10 }}>✕</button>
            </div>
          ))}
        </div>
        {photos.length < MAX_PHOTOS && (
          <label style={{ fontSize: 13, color: "#F5720C", fontWeight: 600, border: "2px dashed #F5720C66", borderRadius: 8, padding: "12px 0", textAlign: "center", cursor: "pointer" }}>
            {photos.length === 0 ? "Choisir une ou plusieurs photos" : "Ajouter d'autres photos"}
            <input type="file" accept="image/*" multiple style={{ display: "none" }}
              onChange={(e) => {
                setPhotos((prev) => [...prev, ...Array.from(e.target.files || []).slice(0, MAX_PHOTOS - prev.length)]);
                e.target.value = "";
              }} />
          </label>
        )}

        <button type="submit" disabled={envoiEnCours} style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "10px 0", fontWeight: 600 }}>
          {envoiEnCours ? "Création..." : "Publier le solde"}
        </button>
      </form>

      {erreurListe && (
        <div style={{ background: "#fff", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <p style={{ color: "red", margin: "0 0 8px" }}>{erreurListe}</p>
          <button onClick={charger} style={{ color: "#F5720C", background: "none", border: "none", fontWeight: 600 }}>Réessayer</button>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden" }}>
        {!erreurListe && soldes.length === 0 && <p style={{ padding: 16, color: "#999" }}>Aucun solde en cours.</p>}
        {soldes.map((s) => (
          <div key={s.id} style={{ borderBottom: "1px solid #eee" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {s.photo_url && <img src={s.photo_url} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover" }} />}
                <div>
                  <strong>{s.titre}</strong>
                  <div style={{ fontSize: 11, color: "#7A7A7A" }}>
                    <span style={{ textDecoration: "line-through" }}>{fmt(s.prix_normal, s.devise)}</span>{" "}
                    <span style={{ color: "#F5720C", fontWeight: 700 }}>{fmt(s.prix_solde, s.devise)}</span>
                    {" · fin le "}{new Date(s.expire_le).toLocaleString("fr-FR")}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                <button style={{ color: "#F5720C" }} onClick={() => (editId === s.id ? setEditId(null) : ouvrirEdition(s))}>
                  {editId === s.id ? "Annuler" : "Modifier"}
                </button>
                <button style={{ color: "red" }} onClick={() => supprimerSolde(s.id)}>Supprimer</button>
              </div>
            </div>

            {editId === s.id && (
              <form onSubmit={modifierSolde} style={{ background: "#F9F9F9", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                {editErreur && <p style={{ color: "red", fontSize: 13 }}>{editErreur}</p>}
                <input value={editForm.titre} onChange={(e) => setEditForm({ ...editForm, titre: e.target.value })} placeholder="Titre" required />
                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Description" rows={2} />
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={editForm.prix_normal} onChange={(e) => setEditForm({ ...editForm, prix_normal: e.target.value })} type="number" placeholder="Prix normal" required style={{ flex: 1 }} />
                  <input value={editForm.prix_solde} onChange={(e) => setEditForm({ ...editForm, prix_solde: e.target.value })} type="number" placeholder="Prix solde" required style={{ flex: 1 }} />
                  <select value={editForm.devise} onChange={(e) => setEditForm({ ...editForm, devise: e.target.value })}>
                    <option value="USD">USD</option>
                    <option value="CDF">CDF</option>
                  </select>
                </div>
                <input value={editForm.quantite} onChange={(e) => setEditForm({ ...editForm, quantite: e.target.value })} type="number" placeholder="Quantité" />
                <label style={{ fontSize: 12, color: "#666" }}>
                  Date et heure de fin
                  <input value={editForm.expire_le} onChange={(e) => setEditForm({ ...editForm, expire_le: e.target.value })} type="datetime-local" required style={{ display: "block", width: "100%", marginTop: 4 }} />
                </label>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {editPhotosExistantes.map((url, i) => (
                    <div key={`e-${i}`} style={{ position: "relative" }}>
                      <img src={url} alt="" style={{ width: 52, height: 52, borderRadius: 6, objectFit: "cover" }} />
                      <button type="button" onClick={() => setEditPhotosExistantes((p) => p.filter((_, idx) => idx !== i))}
                        style={{ position: "absolute", top: -6, right: -6, width: 16, height: 16, borderRadius: "50%", background: "#fff", border: "1px solid #ddd", fontSize: 10 }}>✕</button>
                    </div>
                  ))}
                  {editPhotos.map((f, i) => (
                    <div key={`n-${i}`} style={{ position: "relative" }}>
                      <img src={URL.createObjectURL(f)} alt="" style={{ width: 52, height: 52, borderRadius: 6, objectFit: "cover" }} />
                      <button type="button" onClick={() => setEditPhotos((p) => p.filter((_, idx) => idx !== i))}
                        style={{ position: "absolute", top: -6, right: -6, width: 16, height: 16, borderRadius: "50%", background: "#fff", border: "1px solid #ddd", fontSize: 10 }}>✕</button>
                    </div>
                  ))}
                </div>
                {editPhotosExistantes.length + editPhotos.length < MAX_PHOTOS && (
                  <label style={{ fontSize: 13, color: "#F5720C", fontWeight: 600, border: "2px dashed #F5720C66", borderRadius: 8, padding: "12px 0", textAlign: "center", cursor: "pointer" }}>
                    Ajouter des photos
                    <input type="file" accept="image/*" multiple style={{ display: "none" }}
                      onChange={(e) => {
                        const max = MAX_PHOTOS - editPhotosExistantes.length - editPhotos.length;
                        setEditPhotos((prev) => [...prev, ...Array.from(e.target.files || []).slice(0, max)]);
                        e.target.value = "";
                      }} />
                  </label>
                )}

                <button type="submit" disabled={editEnvoiEnCours} style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "10px 0", fontWeight: 600 }}>
                  {editEnvoiEnCours ? "Enregistrement..." : "Enregistrer les modifications"}
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
