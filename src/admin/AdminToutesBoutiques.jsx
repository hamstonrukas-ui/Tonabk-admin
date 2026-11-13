import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useRole } from "./RoleContext";
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

const cleSpecialite = (t) => t.trim().toLowerCase();

const FORM_VIDE = { nom: "", categorie_id: "", telephone: "", ville: "Bukavu", commune: "", quartier: "", description: "", specialite: "" };
const champ = { width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ddd", boxSizing: "border-box" };

// Formulaire de création d'une boutique par l'admin principal
function CreerBoutique({ onCree, onFermer }) {
  const [form, setForm] = useState(FORM_VIDE);
  const [categories, setCategories] = useState([]);
  const [logo, setLogo] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/api/categories`).then((r) => r.json()).then((c) => Array.isArray(c) && setCategories(c)).catch(() => {});
  }, []);

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const envoyer = async (e) => {
    e.preventDefault();
    setErreur("");
    setEnvoi(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const entetes = { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` };
      const res = await fetchAvecDelai(`${API_URL}/api/boutiques/admin/creer`, { method: "POST", headers: entetes, body: JSON.stringify(form) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(res.status === 404 ? "Route introuvable : redéployez le backend." : data.error || `Erreur ${res.status}`);

      let boutique = data;
      let avertissement = "";
      if (logo) {
        try {
          const fd = new FormData();
          fd.append("photo", logo);
          fd.append("boutiqueId", data.id);
          const up = await fetchAvecDelai(`${API_URL}/api/upload/photo-boutique-logo`, {
            method: "POST", headers: { Authorization: `Bearer ${session?.access_token}` }, body: fd,
          }, 60000);
          if (!up.ok) throw new Error();
          const { url } = await up.json();
          await fetchAvecDelai(`${API_URL}/api/boutiques/${data.id}`, {
            method: "PUT", headers: entetes,
            body: JSON.stringify({ nom: data.nom, description: data.description, telephone: data.telephone, quartier: data.quartier, ville: data.ville, commune: data.commune, categorie_id: data.categorie_id, logo_url: url }),
          });
          boutique = { ...data, logo_url: url };
        } catch {
          avertissement = "La boutique est créée, mais le logo n'a pas pu être envoyé.";
        }
      }
      const cat = categories.find((c) => String(c.id) === String(boutique.categorie_id));
      onCree({
        id: boutique.id, nom: boutique.nom, ville: boutique.ville, commune: boutique.commune, quartier: boutique.quartier,
        logo_url: boutique.logo_url || null, statut: boutique.statut, certifiee: false,
        categories: cat ? { nom: cat.nom } : null, specialite: form.specialite.trim(),
      }, avertissement);
    } catch (err) {
      setErreur(err.name === "AbortError" ? "Le serveur met trop de temps à répondre." : err.message);
    }
    setEnvoi(false);
  };

  return (
    <form onSubmit={envoyer} style={{ background: "#fff", borderRadius: 10, padding: 16, margin: "12px 0", display: "flex", flexDirection: "column", gap: 8, maxWidth: 480 }}>
      <strong>Nouvelle boutique</strong>
      {erreur && <p style={{ color: "red", fontSize: 13, margin: 0 }}>{erreur}</p>}
      <input name="nom" value={form.nom} onChange={change} placeholder="Nom de la boutique *" required style={champ} />
      <select name="categorie_id" value={form.categorie_id} onChange={change} style={champ}>
        <option value="">Catégorie</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.icone} {c.nom}</option>)}
      </select>
      <input name="telephone" type="tel" value={form.telephone} onChange={change} placeholder="Numéro WhatsApp du commerçant *" required style={champ} />
      <div style={{ display: "flex", gap: 8 }}>
        {["Bukavu", "Goma"].map((v) => (
          <button key={v} type="button" onClick={() => setForm((f) => ({ ...f, ville: v }))}
            style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #F5720C", cursor: "pointer", fontWeight: 600, background: form.ville === v ? "#F5720C" : "#fff", color: form.ville === v ? "#fff" : "#F5720C" }}>
            {v}
          </button>
        ))}
      </div>
      <input name="commune" value={form.commune} onChange={change} placeholder="Commune" style={champ} />
      <input name="quartier" value={form.quartier} onChange={change} placeholder="Adresse" style={champ} />
      <input name="specialite" value={form.specialite} onChange={change} placeholder="Spécialité (ex : chaussures homme)" style={champ} />
      <textarea name="description" value={form.description} onChange={change} placeholder="Description" rows={3} style={{ ...champ, resize: "none" }} />
      <label style={{ fontSize: 12, color: "#7A7A7A" }}>
        Logo / photo de profil (optionnel)
        <input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files[0] || null)} style={{ display: "block", marginTop: 4 }} />
      </label>
      <p style={{ fontSize: 11, color: "#999", margin: 0 }}>
        La boutique est créée à votre nom. Le commerçant pourra la récupérer avec son compte grâce à « Récupération de boutique » (nom + numéro WhatsApp).
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={envoi} style={{ flex: 1, background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: 10, fontWeight: 600, cursor: "pointer" }}>
          {envoi ? "Création…" : "Créer la boutique"}
        </button>
        <button type="button" onClick={onFermer} style={{ padding: 10, borderRadius: 6, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>Annuler</button>
      </div>
    </form>
  );
}

export default function AdminToutesBoutiques() {
  const complet = useRole() === "admin";
  const [creation, setCreation] = useState(false);
  const [message, setMessage] = useState("");
  const [boutiques, setBoutiques] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState("");
  const [vue, setVue] = useState("liste"); // "liste" | "specialites"
  const [filtre, setFiltre] = useState("toutes"); // vue spécialités : "toutes" | "sans" | une spécialité
  const [saisies, setSaisies] = useState({}); // id -> spécialité en cours de saisie
  const [etat, setEtat] = useState({}); // id -> "en_cours" | "ok" | message d'erreur

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

  // Spécialités distinctes avec le nombre de boutiques (regroupées sans tenir compte des majuscules)
  const resume = useMemo(() => {
    const m = new Map();
    for (const b of boutiques || []) {
      if (!b.specialite) continue;
      const k = cleSpecialite(b.specialite);
      const e = m.get(k) || { cle: k, texte: b.specialite, n: 0 };
      e.n++;
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => b.n - a.n || a.texte.localeCompare(b.texte));
  }, [boutiques]);

  if (erreur) return <p style={{ color: "red" }}>{erreur}</p>;
  if (boutiques === null) return <p style={{ color: "#999" }}>Chargement...</p>;

  const q = recherche.toLowerCase();
  const filtrees = boutiques.filter((b) =>
    b.nom.toLowerCase().includes(q) || (b.specialite || "").toLowerCase().includes(q)
  );
  const sansSpecialite = boutiques.filter((b) => !b.specialite).length;

  const affichees = vue === "specialites"
    ? filtrees.filter((b) =>
        filtre === "toutes" ? true : filtre === "sans" ? !b.specialite : cleSpecialite(b.specialite || "") === filtre
      )
    : filtrees;

  const enregistrer = async (b) => {
    const valeur = (saisies[b.id] ?? b.specialite ?? "").trim();
    setEtat((x) => ({ ...x, [b.id]: "en_cours" }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetchAvecDelai(`${API_URL}/api/boutiques/admin/${b.id}/specialite`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ specialite: valeur }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(res.status === 404 ? "Route introuvable : redéployez le backend." : data.error || `Erreur ${res.status}`);
      setBoutiques((prev) => prev.map((x) => (x.id === b.id ? { ...x, specialite: data.specialite } : x)));
      setSaisies((prev) => { const n = { ...prev }; delete n[b.id]; return n; });
      setEtat((x) => ({ ...x, [b.id]: "ok" }));
      setTimeout(() => setEtat((x) => (x[b.id] === "ok" ? { ...x, [b.id]: undefined } : x)), 2000);
    } catch (err) {
      setEtat((x) => ({ ...x, [b.id]: err.name === "AbortError" ? "Le serveur met trop de temps à répondre." : err.message }));
    }
  };

  const onglet = (actif) => ({
    padding: "8px 14px", borderRadius: 999, border: "1px solid #F5720C", fontWeight: 600, fontSize: 13, cursor: "pointer",
    background: actif ? "#F5720C" : "#fff", color: actif ? "#fff" : "#F5720C",
  });
  const puce = (actif) => ({
    padding: "4px 10px", borderRadius: 999, border: "1px solid #ddd", fontSize: 12, cursor: "pointer",
    background: actif ? "#1B1B1B" : "#fff", color: actif ? "#fff" : "#444",
  });

  const Pastille = ({ b }) =>
    b.logo_url ? (
      <img src={b.logo_url} alt={b.nom} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
    ) : (
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#F5720C", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>
        {b.nom.slice(0, 2).toUpperCase()}
      </div>
    );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ margin: 0 }}>Toutes les boutiques ({boutiques.length})</h1>
        {complet && !creation && (
          <button onClick={() => { setCreation(true); setMessage(""); }} style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "9px 14px", fontWeight: 600, cursor: "pointer" }}>
            + Créer une boutique
          </button>
        )}
      </div>
      {message && <p style={{ color: "#2E7D32", fontSize: 13 }}>{message}</p>}
      {complet && creation && (
        <CreerBoutique
          onFermer={() => setCreation(false)}
          onCree={(b, avert) => {
            setBoutiques((prev) => [b, ...prev]);
            setCreation(false);
            setMessage(avert || `Boutique « ${b.nom} » créée.`);
          }}
        />
      )}

      <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
        <button onClick={() => setVue("liste")} style={onglet(vue === "liste")}>Boutiques</button>
        <button onClick={() => setVue("specialites")} style={onglet(vue === "specialites")}>Spécialités</button>
      </div>

      <input
        value={recherche} onChange={(e) => setRecherche(e.target.value)}
        placeholder={vue === "specialites" ? "Rechercher une boutique ou une spécialité..." : "Rechercher une boutique..."}
        style={{ width: "100%", maxWidth: 320, padding: 8, margin: "4px 0 12px", borderRadius: 6, border: "1px solid #ddd" }}
      />

      {vue === "liste" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtrees.map((b) => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", padding: 12, borderRadius: 8 }}>
              <Pastille b={b} />
              <div style={{ flex: 1 }}>
                <strong>{b.nom}</strong> {b.certifiee && "✔"}
                <div style={{ fontSize: 12, color: "#7A7A7A" }}>
                  {[b.ville, b.commune, b.quartier].filter(Boolean).join(" — ")} · {b.categories?.nom || "Sans catégorie"} · {b.statut}
                </div>
                {b.specialite && <div style={{ fontSize: 12, color: "#F5720C", fontWeight: 600, marginTop: 2 }}>🏷️ {b.specialite}</div>}
              </div>
              <Link to={`/boutiques/${b.id}/produits`} style={{ background: "#F5720C", color: "#fff", padding: "6px 10px", borderRadius: 6, textDecoration: "none", fontSize: 13 }}>
                Gérer les produits
              </Link>
            </div>
          ))}
          {filtrees.length === 0 && <p style={{ color: "#999" }}>Aucune boutique trouvée</p>}
        </div>
      )}

      {vue === "specialites" && (
        <div>
          <p style={{ fontSize: 12, color: "#7A7A7A", marginTop: 0 }}>
            Notez ce que vend chaque boutique (ex : « chaussures homme », « électronique »). Ces notes sont visibles uniquement par l'équipe.
          </p>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            <button onClick={() => setFiltre("toutes")} style={puce(filtre === "toutes")}>Toutes ({boutiques.length})</button>
            <button onClick={() => setFiltre("sans")} style={puce(filtre === "sans")}>Sans spécialité ({sansSpecialite})</button>
            {resume.map((r) => (
              <button key={r.cle} onClick={() => setFiltre(r.cle)} style={puce(filtre === r.cle)}>{r.texte} ({r.n})</button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {affichees.map((b) => {
              const valeur = saisies[b.id] ?? b.specialite ?? "";
              const modifie = valeur.trim() !== (b.specialite || "");
              const e = etat[b.id];
              return (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", padding: 12, borderRadius: 8, flexWrap: "wrap" }}>
                  <Pastille b={b} />
                  <div style={{ flex: "1 1 140px", minWidth: 0 }}>
                    <strong>{b.nom}</strong> {b.certifiee && "✔"}
                    <div style={{ fontSize: 12, color: "#7A7A7A" }}>
                      {[b.commune, b.quartier].filter(Boolean).join(" — ")} · {b.categories?.nom || "Sans catégorie"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flex: "2 1 240px" }}>
                    <input
                      value={valeur} maxLength={200} placeholder="Spécialité (ex : chaussures homme)"
                      onChange={(ev) => setSaisies((x) => ({ ...x, [b.id]: ev.target.value }))}
                      onKeyDown={(ev) => { if (ev.key === "Enter" && modifie) enregistrer(b); }}
                      style={{ flex: 1, minWidth: 0, padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
                    />
                    <button
                      onClick={() => enregistrer(b)}
                      disabled={!modifie || e === "en_cours"}
                      style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "0 12px", fontWeight: 600, opacity: !modifie || e === "en_cours" ? 0.4 : 1 }}
                    >
                      {e === "en_cours" ? "..." : "Enregistrer"}
                    </button>
                  </div>
                  {e === "ok" && <span style={{ color: "#2E7D32", fontSize: 12, flexBasis: "100%" }}>✓ Enregistré</span>}
                  {e && e !== "ok" && e !== "en_cours" && <span style={{ color: "red", fontSize: 12, flexBasis: "100%" }}>{e}</span>}
                </div>
              );
            })}
            {affichees.length === 0 && <p style={{ color: "#999" }}>Aucune boutique dans cette sélection</p>}
          </div>
        </div>
      )}
    </div>
  );
}
