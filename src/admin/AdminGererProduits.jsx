import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";

async function authHeaders(json = true) {
  const { data: { session } } = await supabase.auth.getSession();
  return json
    ? { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` }
    : { Authorization: `Bearer ${session?.access_token}` };
}

async function fetchAvecDelai(url, options = {}, delaiMs = 15000) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), delaiMs);
  try {
    return await fetch(url, { ...options, signal: controleur.signal });
  } finally {
    clearTimeout(minuteur);
  }
}

const fmt = (n, devise = "USD") => Number(n).toLocaleString("fr-FR") + " " + devise;

export default function AdminGererProduits() {
  const { id } = useParams();
  const [boutique, setBoutique] = useState(null);
  const [produits, setProduits] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const [nom, setNom] = useState("");
  const [prix, setPrix] = useState("");
  const [devise, setDevise] = useState("USD");
  const [stock, setStock] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  async function charger() {
    setChargement(true);
    setErreur("");
    try {
      const headers = await authHeaders();
      const [resB, resP] = await Promise.all([
        fetchAvecDelai(`${API_URL}/api/boutiques/${id}`),
        fetchAvecDelai(`${API_URL}/api/produits?boutique_id=${id}`),
      ]);
      if (resB.ok) setBoutique(await resB.json());
      if (resP.ok) setProduits(await resP.json());
    } catch (err) {
      setErreur(err.name === "AbortError" ? "Le serveur met trop de temps à répondre." : "Connexion au serveur impossible.");
    }
    setChargement(false);
  }

  useEffect(() => { charger(); }, [id]);

  const ajouterProduit = async (e) => {
    e.preventDefault();
    setErreur("");
    if (!nom.trim() || !prix) { setErreur("Nom et prix requis"); return; }
    setEnvoiEnCours(true);

    try {
      let photo_url, photo_thumb_url;

      if (photo) {
        const headersUpload = await authHeaders(false);
        const formData = new FormData();
        formData.append("photo", photo);
        formData.append("boutiqueId", id);

        const resUpload = await fetchAvecDelai(`${API_URL}/api/upload/photo`, {
          method: "POST",
          headers: headersUpload,
          body: formData,
        });

        if (!resUpload.ok) {
          const data = await resUpload.json().catch(() => ({}));
          setErreur(data.message || data.error || "Échec de l'upload de la photo");
          setEnvoiEnCours(false);
          return;
        }
        const dataUpload = await resUpload.json();
        photo_url = dataUpload.url;
        photo_thumb_url = dataUpload.url;
      }

      const headers = await authHeaders();
      const res = await fetchAvecDelai(`${API_URL}/api/produits`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          boutique_id: id,
          nom: nom.trim(),
          prix: Number(prix),
          devise,
          stock: Number(stock) || 0,
          description,
          photo_url,
          photo_thumb_url,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErreur(data.error || "Échec de l'ajout du produit");
        setEnvoiEnCours(false);
        return;
      }

      setNom(""); setPrix(""); setDevise("USD"); setStock(""); setDescription(""); setPhoto(null);
      charger();
    } catch (err) {
      setErreur(
        err.name === "AbortError"
          ? "Le serveur met trop de temps à répondre. Réessayez dans un instant."
          : "Une erreur est survenue. Vérifiez la connexion."
      );
    }
    setEnvoiEnCours(false);
  };

  const supprimerProduit = async (produitId) => {
    if (!confirm("Supprimer ce produit ?")) return;
    const headers = await authHeaders();
    await fetchAvecDelai(`${API_URL}/api/produits/${produitId}`, { method: "DELETE", headers });
    charger();
  };

  if (chargement) return <p style={{ padding: 16, color: "#999" }}>Chargement...</p>;
  if (!boutique) return <p style={{ padding: 16, color: "#999" }}>Boutique introuvable</p>;

  return (
    <div>
      <Link to="/boutiques" style={{ fontSize: 13, color: "#F5720C" }}>← Retour aux boutiques</Link>
      <h1 style={{ marginTop: 8 }}>{boutique.nom}</h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
        Tu ajoutes ici un produit pour le compte du commerçant — utile pour l'aider en direct
        (par téléphone ou sur place) s'il n'est pas à l'aise avec l'app.
      </p>

      <form
        onSubmit={ajouterProduit}
        style={{ background: "#fff", borderRadius: 10, padding: 16, marginBottom: 20, display: "flex", flexDirection: "column", gap: 8, maxWidth: 420 }}
      >
        {erreur && <p style={{ color: "red", fontSize: 13 }}>{erreur}</p>}
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom du produit" required />
        <div style={{ display: "flex", gap: 8 }}>
          <input value={prix} onChange={(e) => setPrix(e.target.value)} type="number" placeholder="Prix" required style={{ flex: 1 }} />
          <select value={devise} onChange={(e) => setDevise(e.target.value)}>
            <option value="USD">USD</option>
            <option value="CDF">CDF</option>
          </select>
        </div>
        <input value={stock} onChange={(e) => setStock(e.target.value)} type="number" placeholder="Stock" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={2} />
        <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} />
        <button type="submit" disabled={envoiEnCours} style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "10px 0", fontWeight: 600 }}>
          {envoiEnCours ? "Ajout..." : "Ajouter le produit"}
        </button>
      </form>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Produits actuels ({produits.length})</h2>
      <div style={{ borderRadius: 10, overflow: "hidden" }}>
        {produits.map((p) => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderBottom: "1px solid #eee", background: "#fff" }}>
            <div>
              <strong>{p.nom}</strong> — {fmt(p.prix, p.devise)}
              <div style={{ fontSize: 11, color: "#7A7A7A" }}>Stock : {p.stock}</div>
            </div>
            <button style={{ color: "red" }} onClick={() => supprimerProduit(p.id)}>Supprimer</button>
          </div>
        ))}
        {produits.length === 0 && <p style={{ padding: 16, color: "#999" }}>Aucun produit pour l'instant</p>}
      </div>
    </div>
  );
      }
          
