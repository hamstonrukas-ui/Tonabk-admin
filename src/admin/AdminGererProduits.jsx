 import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";
import { reduireImage } from "../lib/image";
import { useRole } from "./RoleContext";

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
  const complet = useRole() === "admin";
  const { id } = useParams();
  const [boutique, setBoutique] = useState(null);
  const [produits, setProduits] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const [nom, setNom] = useState("");
  const [prix, setPrix] = useState("");
  const [devise, setDevise] = useState("USD");
  const [prixGros, setPrixGros] = useState("");
  const [quantiteMinGros, setQuantiteMinGros] = useState("");
  const [stock, setStock] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const [editId, setEditId] = useState(null);
  const [editNom, setEditNom] = useState("");
  const [editPrix, setEditPrix] = useState("");
  const [editDevise, setEditDevise] = useState("USD");
  const [editPrixGros, setEditPrixGros] = useState("");
  const [editQuantiteMinGros, setEditQuantiteMinGros] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPhoto, setEditPhoto] = useState(null);
  const [editEnvoiEnCours, setEditEnvoiEnCours] = useState(false);
  const [editErreur, setEditErreur] = useState("");

  // Repères (numéro + source des photos)
  const [reperes, setReperes] = useState({}); // produit_id -> { code, fournisseur_nom, fournisseur_contact, note }
  const [srcNom, setSrcNom] = useState("");
  const [srcContact, setSrcContact] = useState("");
  const [srcNote, setSrcNote] = useState("");
  const [lotSrcNom, setLotSrcNom] = useState("");
  const [lotSrcContact, setLotSrcContact] = useState("");
  const [editSrcNom, setEditSrcNom] = useState("");
  const [editSrcContact, setEditSrcContact] = useState("");
  const [editSrcNote, setEditSrcNote] = useState("");

  const enregistrerRepere = async (produitId, nom, contact, note = "") => {
    if (!nom.trim() && !contact.trim() && !note.trim()) return;
    try {
      await fetchAvecDelai(`${API_URL}/api/reperes/produit/${produitId}`, {
        method: "PUT",
        headers: await authHeaders(),
        body: JSON.stringify({ fournisseur_nom: nom, fournisseur_contact: contact, note }),
      });
    } catch {
      /* le produit est créé ; le repère pourra être ajouté via « Modifier » */
    }
  };

  const MAX_PAR_LOT = 10;
  const [afficherLot, setAfficherLot] = useState(false);
  const [deviseLot, setDeviseLot] = useState("USD");
  const [lignesLot, setLignesLot] = useState([]); // { id, fichier, apercu, nom, prix, erreur }
  const [lotEnCours, setLotEnCours] = useState(false);
  const [lotProgression, setLotProgression] = useState(0);
  const [lotTotal, setLotTotal] = useState(0);
  const [sousCategories, setSousCategories] = useState([]); // rangement : sous-catégories de la catégorie de la boutique
  const [lotRacineId, setLotRacineId] = useState("");
  const [lotTypeId, setLotTypeId] = useState("");

  const choisirPhotosLot = (e) => {
    const fichiers = Array.from(e.target.files || []).slice(0, MAX_PAR_LOT - lignesLot.length);
    const nouvelles = fichiers.map((f, i) => ({
      id: `${Date.now()}-${i}`,
      fichier: f,
      apercu: URL.createObjectURL(f),
      nom: "",
      prix: "",
      erreur: "",
    }));
    setLignesLot((prev) => [...prev, ...nouvelles]);
    e.target.value = "";
  };

  const majLigneLot = (lid, champ, valeur) =>
    setLignesLot((prev) => prev.map((l) => (l.id === lid ? { ...l, [champ]: valeur } : l)));

  const retirerLigneLot = (lid) => setLignesLot((prev) => prev.filter((l) => l.id !== lid));

  const publierLot = async () => {
    const incompletes = lignesLot.filter((l) => !l.nom.trim() || !l.prix);
    if (incompletes.length) {
      setLignesLot((prev) =>
        prev.map((l) => (!l.nom.trim() || !l.prix ? { ...l, erreur: "Nom et prix requis" } : { ...l, erreur: "" }))
      );
      return;
    }

    setLotEnCours(true);
    setLotTotal(lignesLot.length);
    setLotProgression(0);
    const restantes = [];

    for (const ligne of lignesLot) {
      try {
        const headersUpload = await authHeaders(false);
        const photoReduite = await reduireImage(ligne.fichier);
        const formData = new FormData();
        formData.append("photo", photoReduite);
        formData.append("boutiqueId", id);

        const resUpload = await fetchAvecDelai(`${API_URL}/api/upload/photo`, {
          method: "POST", headers: headersUpload, body: formData,
        });
        if (!resUpload.ok) {
          const data = await resUpload.json().catch(() => ({}));
          throw new Error(data.message || data.error || "Échec de l'envoi de la photo");
        }
        const { url } = await resUpload.json();

        const headersJson = await authHeaders();
        const res = await fetchAvecDelai(`${API_URL}/api/produits`, {
          method: "POST",
          headers: headersJson,
          body: JSON.stringify({
            boutique_id: id,
            nom: ligne.nom.trim(),
            prix: Number(ligne.prix),
            devise: deviseLot,
            stock: Math.floor(Math.random() * 100) + 1, // aléatoire de 1 à 100, jamais 0
            description: "",
            photo_url: url,
            photo_thumb_url: url,
            prix_gros: null,
            quantite_min_gros: null,
            sous_categorie_id: complet ? lotTypeId || lotRacineId || null : null,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Échec de l'ajout du produit");
        }
        const produitCree = await res.json().catch(() => null);
        if (produitCree?.id) await enregistrerRepere(produitCree.id, lotSrcNom, lotSrcContact);
      } catch (err) {
        restantes.push({ ...ligne, erreur: err.message || "Erreur" });
      }
      setLotProgression((p) => p + 1);
    }

    setLotEnCours(false);
    setLignesLot(restantes);
    charger();
    if (restantes.length === 0) {
      setAfficherLot(false);
      setLotSrcNom(""); setLotSrcContact("");
      setLotRacineId("");
      setLotTypeId("");
    }
  };

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
      try {
        const resR = await fetchAvecDelai(`${API_URL}/api/reperes/boutique/${id}`, { headers });
        if (resR.ok) setReperes(await resR.json());
      } catch {
        /* repères indisponibles : le reste de la page fonctionne */
      }
    } catch (err) {
      setErreur(err.name === "AbortError" ? "Le serveur met trop de temps à répondre." : "Connexion au serveur impossible.");
    }
    setChargement(false);
  }

  useEffect(() => { charger(); }, [id]);

  // Sous-catégories proposées pour ranger le lot (admin complet uniquement)
  useEffect(() => {
    if (!complet || !boutique?.categorie_id) { setSousCategories([]); return; }
    (async () => {
      try {
        const res = await fetchAvecDelai(`${API_URL}/api/sous-categories?categorie_id=${encodeURIComponent(boutique.categorie_id)}`);
        const data = await res.json();
        if (res.ok && Array.isArray(data)) setSousCategories(data);
      } catch {
        /* sans sous-catégories, l'ajout en lot reste possible */
      }
    })();
  }, [complet, boutique?.categorie_id]);

  const racinesLot = sousCategories.filter((s) => !s.parent_id);
  const typesLot = sousCategories.filter((s) => lotRacineId && s.parent_id === lotRacineId);

  const ajouterProduit = async (e) => {
    e.preventDefault();
    setErreur("");
    if (!nom.trim() || !prix) { setErreur("Nom et prix requis"); return; }
    setEnvoiEnCours(true);

    try {
      let photo_url, photo_thumb_url;

      if (photo) {
        const headersUpload = await authHeaders(false);
        const photoReduite = await reduireImage(photo);
        const formData = new FormData();
        formData.append("photo", photoReduite);
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
          prix_gros: prixGros ? Number(prixGros) : null,
          quantite_min_gros: prixGros && quantiteMinGros ? Number(quantiteMinGros) : null,
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

      const produitCree = await res.json().catch(() => null);
      if (produitCree?.id) await enregistrerRepere(produitCree.id, srcNom, srcContact, srcNote);
      setSrcNom(""); setSrcContact(""); setSrcNote("");
      setNom(""); setPrix(""); setDevise("USD"); setPrixGros(""); setQuantiteMinGros(""); setStock(""); setDescription(""); setPhoto(null);
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

  const ouvrirEdition = (p) => {
    setEditId(p.id);
    setEditNom(p.nom);
    setEditPrix(p.prix);
    setEditDevise(p.devise || "USD");
    setEditPrixGros(p.prix_gros || "");
    setEditQuantiteMinGros(p.quantite_min_gros || "");
    setEditStock(p.stock ?? "");
    setEditDescription(p.description || "");
    setEditPhoto(null);
    setEditErreur("");
    const r = reperes[p.id] || {};
    setEditSrcNom(r.fournisseur_nom || "");
    setEditSrcContact(r.fournisseur_contact || "");
    setEditSrcNote(r.note || "");
  };

  const modifierProduit = async (e) => {
    e.preventDefault();
    setEditErreur("");
    if (!editNom.trim() || !editPrix) { setEditErreur("Nom et prix requis"); return; }
    setEditEnvoiEnCours(true);

    try {
      let photo_url, photo_thumb_url;

      if (editPhoto) {
        const headersUpload = await authHeaders(false);
        const photoReduite = await reduireImage(editPhoto);
        const formData = new FormData();
        formData.append("photo", photoReduite);
        formData.append("boutiqueId", id);

        const resUpload = await fetchAvecDelai(`${API_URL}/api/upload/photo`, {
          method: "POST", headers: headersUpload, body: formData,
        });
        if (!resUpload.ok) {
          const data = await resUpload.json().catch(() => ({}));
          setEditErreur(data.message || data.error || "Échec de l'upload de la photo");
          setEditEnvoiEnCours(false);
          return;
        }
        const dataUpload = await resUpload.json();
        photo_url = dataUpload.url;
        photo_thumb_url = dataUpload.url;
      }

      const headers = await authHeaders();
      const res = await fetchAvecDelai(`${API_URL}/api/produits/${editId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          nom: editNom.trim(),
          prix: Number(editPrix),
          devise: editDevise,
          prix_gros: editPrixGros ? Number(editPrixGros) : null,
          quantite_min_gros: editPrixGros && editQuantiteMinGros ? Number(editQuantiteMinGros) : null,
          stock: Number(editStock) || 0,
          description: editDescription,
          photo_url,
          photo_thumb_url,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setEditErreur(data.error || "Échec de la modification");
        setEditEnvoiEnCours(false);
        return;
      }

      await enregistrerRepere(editId, editSrcNom, editSrcContact, editSrcNote);
      setEditId(null);
      charger();
    } catch (err) {
      setEditErreur(
        err.name === "AbortError"
          ? "Le serveur met trop de temps à répondre. Réessayez dans un instant."
          : "Une erreur est survenue. Vérifiez la connexion."
      );
    }
    setEditEnvoiEnCours(false);
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

      <button
        onClick={() => setAfficherLot(!afficherLot)}
        style={{ background: "#F5720C1A", color: "#F5720C", border: "none", borderRadius: 6, padding: "8px 14px", fontWeight: 600, fontSize: 13, marginBottom: 12 }}
      >
        {afficherLot ? "Fermer l'ajout en lot" : "+ Ajouter plusieurs produits d'un coup"}
      </button>

      {afficherLot && (
        <div style={{ background: "#fff", borderRadius: 10, padding: 16, marginBottom: 20, maxWidth: 420, display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 12, color: "#666" }}>
            Choisissez jusqu'à {MAX_PAR_LOT} photos, donnez un nom et un prix à chacune, puis publiez-les toutes en un clic.
          </p>

          {lignesLot.length < MAX_PAR_LOT && (
            <label style={{ textAlign: "center", border: "2px dashed #F5720C66", borderRadius: 8, padding: 14, fontSize: 13, fontWeight: 600, color: "#F5720C", cursor: "pointer" }}>
              {lignesLot.length === 0 ? `Choisir jusqu'à ${MAX_PAR_LOT} photos` : "Ajouter d'autres photos"}
              <input type="file" accept="image/*" multiple onChange={choisirPhotosLot} style={{ display: "none" }} disabled={lotEnCours} />
            </label>
          )}

          {lignesLot.length > 0 && (
            <>
              <select value={deviseLot} onChange={(e) => setDeviseLot(e.target.value)} disabled={lotEnCours}>
                <option value="USD">Tous les prix en USD ($)</option>
                <option value="CDF">Tous les prix en CDF (FC)</option>
              </select>

              {complet && racinesLot.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <p style={{ fontSize: 12, color: "#666", margin: 0 }}>Ranger tous les produits de ce lot dans :</p>
                  <select
                    value={lotRacineId}
                    onChange={(e) => { setLotRacineId(e.target.value); setLotTypeId(""); }}
                    disabled={lotEnCours}
                  >
                    <option value="">Sous-catégorie (optionnel)</option>
                    {racinesLot.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}
                  </select>
                  {lotRacineId && typesLot.length > 0 && (
                    <select value={lotTypeId} onChange={(e) => setLotTypeId(e.target.value)} disabled={lotEnCours}>
                      <option value="">Type d'article (optionnel)</option>
                      {typesLot.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
                    </select>
                  )}
                </div>
              )}


        <div style={{ background: "#FFF7F0", border: "1px dashed #F5720C", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ fontSize: 12, color: "#B25000", margin: 0 }}>
            Repère (privé, jamais visible du public) — d'où vient cette photo ? Un numéro de repère est attribué automatiquement.
          </p>
          <input value={lotSrcNom} onChange={(e) => setLotSrcNom(e.target.value)} placeholder="Source / fournisseur (ex : TikTok @modeKinshasa)" />
          <input value={lotSrcContact} onChange={(e) => setLotSrcContact(e.target.value)} placeholder="Contact du fournisseur (téléphone, lien…)" />
        </div>

              {lignesLot.map((l) => (
                <div key={l.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <img src={l.apercu} alt="" style={{ width: 52, height: 52, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                    <input value={l.nom} onChange={(e) => majLigneLot(l.id, "nom", e.target.value)} placeholder="Nom du produit" disabled={lotEnCours} />
                    <input value={l.prix} onChange={(e) => majLigneLot(l.id, "prix", e.target.value)} type="number" placeholder="Prix" disabled={lotEnCours} />
                    {l.erreur && <p style={{ fontSize: 11, color: "red", margin: 0 }}>{l.erreur}</p>}
                  </div>
                  {!lotEnCours && (
                    <button onClick={() => retirerLigneLot(l.id)} style={{ color: "#999", background: "none", border: "none" }}>✕</button>
                  )}
                </div>
              ))}

              <button
                onClick={publierLot}
                disabled={lotEnCours}
                style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "10px 0", fontWeight: 600 }}
              >
                {lotEnCours ? `Publication ${lotProgression}/${lotTotal}...` : `Publier ${lignesLot.length} produit${lignesLot.length > 1 ? "s" : ""}`}
              </button>
            </>
          )}
        </div>
      )}

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

        <div style={{ background: "#F6F6F6", borderRadius: 8, padding: 10 }}>
          <p style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
            Prix de gros (optionnel) — laissez vide si le vendeur vend uniquement au détail
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={prixGros} onChange={(e) => setPrixGros(e.target.value)} type="number"
              placeholder={`Prix de gros (${devise})`} style={{ flex: 1 }}
            />
            <input
              value={quantiteMinGros} onChange={(e) => setQuantiteMinGros(e.target.value)} type="number"
              placeholder="Qté min." disabled={!prixGros} style={{ width: 90 }}
            />
          </div>
        </div>

        <input value={stock} onChange={(e) => setStock(e.target.value)} type="number" placeholder="Stock" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={2} />

        <div style={{ background: "#FFF7F0", border: "1px dashed #F5720C", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ fontSize: 12, color: "#B25000", margin: 0 }}>
            Repère (privé, jamais visible du public) — d'où vient cette photo ? Un numéro de repère est attribué automatiquement.
          </p>
          <input value={srcNom} onChange={(e) => setSrcNom(e.target.value)} placeholder="Source / fournisseur (ex : TikTok @modeKinshasa)" />
          <input value={srcContact} onChange={(e) => setSrcContact(e.target.value)} placeholder="Contact du fournisseur (téléphone, lien…)" />
          <input value={srcNote} onChange={(e) => setSrcNote(e.target.value)} placeholder="Note (optionnel)" />
        </div>
        <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} />
        <button type="submit" disabled={envoiEnCours} style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "10px 0", fontWeight: 600 }}>
          {envoiEnCours ? "Ajout..." : "Ajouter le produit"}
        </button>
      </form>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Produits actuels ({produits.length})</h2>
      <div style={{ borderRadius: 10, overflow: "hidden" }}>
        {produits.map((p) => (
          <div key={p.id} style={{ borderBottom: "1px solid #eee", background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12 }}>
              <div>
                <strong>{p.nom}</strong> — {fmt(p.prix, p.devise)}
                <div style={{ fontSize: 11, color: "#7A7A7A" }}>Stock : {p.stock}</div>
                {reperes[p.id] && (
                  <div style={{ fontSize: 11, color: "#B25000", marginTop: 2 }}>
                    Repère <strong>#{reperes[p.id].code}</strong>
                    {reperes[p.id].fournisseur_nom ? ` · ${reperes[p.id].fournisseur_nom}` : ""}
                    {reperes[p.id].fournisseur_contact ? ` · ${reperes[p.id].fournisseur_contact}` : ""}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={{ color: "#F5720C" }} onClick={() => (editId === p.id ? setEditId(null) : ouvrirEdition(p))}>
                  {editId === p.id ? "Annuler" : "Modifier"}
                </button>
                {complet && <button style={{ color: "red" }} onClick={() => supprimerProduit(p.id)}>Supprimer</button>}
              </div>
            </div>

            {editId === p.id && (
              <form
                onSubmit={modifierProduit}
                style={{ background: "#F9F9F9", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}
              >
                {editErreur && <p style={{ color: "red", fontSize: 13 }}>{editErreur}</p>}
                <input value={editNom} onChange={(e) => setEditNom(e.target.value)} placeholder="Nom du produit" required />
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={editPrix} onChange={(e) => setEditPrix(e.target.value)} type="number" placeholder="Prix" required style={{ flex: 1 }} />
                  <select value={editDevise} onChange={(e) => setEditDevise(e.target.value)}>
                    <option value="USD">USD</option>
                    <option value="CDF">CDF</option>
                  </select>
                </div>

                <div style={{ background: "#fff", borderRadius: 8, padding: 10 }}>
                  <p style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                    Prix de gros (optionnel) — laissez vide si le vendeur vend uniquement au détail
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={editPrixGros} onChange={(e) => setEditPrixGros(e.target.value)} type="number"
                      placeholder={`Prix de gros (${editDevise})`} style={{ flex: 1 }}
                    />
                    <input
                      value={editQuantiteMinGros} onChange={(e) => setEditQuantiteMinGros(e.target.value)} type="number"
                      placeholder="Qté min." disabled={!editPrixGros} style={{ width: 90 }}
                    />
                  </div>
                </div>

                <input value={editStock} onChange={(e) => setEditStock(e.target.value)} type="number" placeholder="Stock" />
                <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description" rows={2} />


        <div style={{ background: "#FFF7F0", border: "1px dashed #F5720C", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ fontSize: 12, color: "#B25000", margin: 0 }}>
            Repère (privé, jamais visible du public) — d'où vient cette photo ? Un numéro de repère est attribué automatiquement.
          </p>
          <input value={editSrcNom} onChange={(e) => setEditSrcNom(e.target.value)} placeholder="Source / fournisseur (ex : TikTok @modeKinshasa)" />
          <input value={editSrcContact} onChange={(e) => setEditSrcContact(e.target.value)} placeholder="Contact du fournisseur (téléphone, lien…)" />
          <input value={editSrcNote} onChange={(e) => setEditSrcNote(e.target.value)} placeholder="Note (optionnel)" />
        </div>

                {p.photo_url && (
                  <img src={p.photo_url} alt="" style={{ width: 60, height: 60, borderRadius: 6, objectFit: "cover" }} />
                )}
                <label style={{ fontSize: 12, color: "#666" }}>
                  Remplacer la photo (laisser vide pour garder l'actuelle)
                  <input type="file" accept="image/*" onChange={(e) => setEditPhoto(e.target.files[0])} />
                </label>

                <button type="submit" disabled={editEnvoiEnCours} style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "10px 0", fontWeight: 600 }}>
                  {editEnvoiEnCours ? "Enregistrement..." : "Enregistrer les modifications"}
                </button>
              </form>
            )}
          </div>
        ))}
        {produits.length === 0 && <p style={{ padding: 16, color: "#999" }}>Aucun produit pour l'instant</p>}
      </div>
    </div>
  );
}
