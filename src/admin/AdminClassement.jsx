// src/admin/AdminClassement.jsx — page « Classer les articles » (admin complet uniquement)
// Choisir une catégorie, cocher des articles, choisir une sous-catégorie (+ type) et les ranger.
// Les articles déjà rangés disparaissent de l'onglet « À ranger ».
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";

const PAR_PAGE = 60;

async function enTetes() {
  const { data: { session } } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` };
}

async function fetchAvecDelai(url, options = {}, delaiMs = 20000) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), delaiMs);
  try {
    return await fetch(url, { ...options, signal: controleur.signal });
  } finally {
    clearTimeout(minuteur);
  }
}

export default function AdminClassement() {
  const [categories, setCategories] = useState([]);
  const [categorieId, setCategorieId] = useState(null);
  const [sousCategories, setSousCategories] = useState([]);

  const [mode, setMode] = useState("a_ranger"); // a_ranger | ranges
  const [produits, setProduits] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState(() => new Set());

  const [racineId, setRacineId] = useState("");
  const [typeId, setTypeId] = useState("");

  const [chargement, setChargement] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");

  // --- Catégories (au démarrage) ---
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchAvecDelai(`${API_URL}/api/categories`);
        const data = await res.json();
        if (!res.ok) throw new Error();
        setCategories(data);
        if (data.length > 0) setCategorieId(data[0].id);
      } catch {
        setErreur("Impossible de charger les catégories.");
      }
    })();
  }, []);

  // --- Sous-catégories de la catégorie choisie ---
  useEffect(() => {
    setSousCategories([]);
    setRacineId("");
    setTypeId("");
    if (!categorieId) return;
    (async () => {
      try {
        const res = await fetchAvecDelai(`${API_URL}/api/sous-categories?categorie_id=${encodeURIComponent(categorieId)}`);
        const data = await res.json();
        if (res.ok && Array.isArray(data)) setSousCategories(data);
      } catch {
        /* la page reste utilisable : on pourra juste afficher qu'il n'y en a pas */
      }
    })();
  }, [categorieId]);

  const racines = sousCategories.filter((s) => !s.parent_id);
  const types = sousCategories.filter((s) => racineId && s.parent_id === racineId);
  const cible = typeId || racineId; // le niveau le plus précis choisi
  const noeudCible = sousCategories.find((s) => s.id === cible) || null;
  const racineCible = sousCategories.find((s) => s.id === racineId) || null;
  const nomCible = noeudCible
    ? noeudCible.parent_id && racineCible
      ? `${racineCible.nom} › ${noeudCible.nom}`
      : noeudCible.nom
    : "";

  // --- Articles ---
  const charger = useCallback(
    async (p = 1) => {
      if (!categorieId) return;
      setChargement(true);
      setErreur("");
      try {
        const res = await fetchAvecDelai(
          `${API_URL}/api/admin-classement/produits?categorie_id=${encodeURIComponent(categorieId)}&statut=${mode}&page=${p}&limit=${PAR_PAGE}`,
          { headers: await enTetes() }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Impossible de charger les articles");
        setProduits((prev) => (p === 1 ? data.data : [...prev, ...data.data]));
        setTotal(data.total);
        setPage(p);
      } catch (err) {
        setErreur(err.name === "AbortError" ? "Le serveur met trop de temps à répondre." : err.message);
      } finally {
        setChargement(false);
      }
    },
    [categorieId, mode]
  );

  // Changement de catégorie ou de mode : on repart de zéro
  useEffect(() => {
    setSelection(new Set());
    setMessage("");
    setProduits([]);
    setTotal(0);
    charger(1);
  }, [charger]);

  const basculer = (id) =>
    setSelection((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });

  const toutSelectionner = () =>
    setSelection((prev) => (prev.size === produits.length ? new Set() : new Set(produits.map((p) => p.id))));

  const classer = async (sousCategorieId) => {
    if (selection.size === 0) return;
    setEnCours(true);
    setErreur("");
    setMessage("");
    try {
      const res = await fetchAvecDelai(`${API_URL}/api/admin-classement/classer`, {
        method: "POST",
        headers: await enTetes(),
        body: JSON.stringify({ produit_ids: [...selection], sous_categorie_id: sousCategorieId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Échec du classement");
      setMessage(
        sousCategorieId
          ? `${data.modifies} article(s) rangé(s) dans « ${nomCible} ».`
          : `${data.modifies} article(s) remis dans « À ranger ».`
      );
      setSelection(new Set());
      await charger(1);
    } catch (err) {
      setErreur(err.name === "AbortError" ? "Le serveur met trop de temps à répondre." : err.message);
    } finally {
      setEnCours(false);
    }
  };

  const chip = (actif) =>
    `whitespace-nowrap text-sm font-semibold px-3.5 py-1.5 rounded-full border ${
      actif ? "bg-brand text-white border-brand" : "bg-white text-[#1B1B1B] border-gray-200"
    }`;
  const select = "border border-gray-200 rounded-md px-3 py-2 text-sm bg-white w-full sm:w-64";

  return (
    <div className="max-w-6xl space-y-4">
      <h1 className="text-xl font-extrabold text-[#1B1B1B]">Classer les articles</h1>

      {/* Catégorie */}
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button key={c.id} onClick={() => setCategorieId(c.id)} className={chip(categorieId === c.id)}>
            {c.nom}
          </button>
        ))}
      </div>

      {/* À ranger / Déjà rangés */}
      <div className="flex items-center gap-2">
        <button onClick={() => setMode("a_ranger")} className={chip(mode === "a_ranger")}>À ranger</button>
        <button onClick={() => setMode("ranges")} className={chip(mode === "ranges")}>Déjà rangés</button>
        <span className="text-sm text-gray-500 ml-auto">{total} article(s)</span>
      </div>

      {/* Destination */}
      <div className="bg-white rounded-xl p-4 space-y-2">
        <p className="text-sm text-gray-500">Ranger les articles cochés dans :</p>
        {racines.length === 0 ? (
          <p className="text-sm text-gray-400">Cette catégorie n'a pas encore de sous-catégories.</p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={racineId}
              onChange={(e) => { setRacineId(e.target.value); setTypeId(""); }}
              className={select}
            >
              <option value="">Sous-catégorie…</option>
              {racines.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}
            </select>
            {racineId && types.length > 0 && (
              <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={select}>
                <option value="">Type d'article (optionnel)…</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
              </select>
            )}
          </div>
        )}
      </div>

      {message && <p className="text-sm text-green-600">{message}</p>}
      {erreur && <p className="text-sm text-red-500">{erreur}</p>}

      {/* Barre d'action */}
      <div className="sticky top-0 z-10 bg-[#F3F3F3] py-2 flex flex-wrap items-center gap-3">
        <button onClick={toutSelectionner} className="text-sm font-semibold text-brand">
          {selection.size === produits.length && produits.length > 0 ? "Tout décocher" : "Tout cocher"}
        </button>
        <span className="text-sm text-gray-500">{selection.size} coché(s)</span>
        <button
          onClick={() => classer(cible)}
          disabled={enCours || selection.size === 0 || !cible}
          className="ml-auto bg-brand text-white text-sm font-semibold rounded-md px-4 py-2 disabled:opacity-40"
        >
          {enCours ? "Classement..." : cible ? `Ranger dans ${nomCible}` : "Choisir une destination"}
        </button>
        {mode === "ranges" && selection.size > 0 && (
          <button
            onClick={() => classer(null)}
            disabled={enCours}
            className="text-sm font-semibold text-red-500 disabled:opacity-40"
          >
            Remettre dans « À ranger »
          </button>
        )}
      </div>

      {/* Articles */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {produits.map((p) => {
          const coche = selection.has(p.id);
          return (
            <button
              key={p.id}
              onClick={() => basculer(p.id)}
              className={`relative bg-white rounded-xl overflow-hidden shadow-sm text-left ${coche ? "ring-2 ring-brand" : ""}`}
            >
              {p.photo_thumb_url || p.photo_url ? (
                <img src={p.photo_thumb_url || p.photo_url} alt="" loading="lazy" className="w-full aspect-square object-cover" />
              ) : (
                <div className="w-full aspect-square bg-gray-100" />
              )}
              {coche && (
                <span className="absolute top-1.5 right-1.5 bg-brand text-white rounded-full w-6 h-6 text-sm flex items-center justify-center">
                  ✓
                </span>
              )}
              <div className="p-2">
                <p className="text-xs font-semibold text-[#1B1B1B] truncate">{p.nom}</p>
                <p className="text-[11px] text-gray-400 truncate">{p.boutiques?.nom}</p>
                {mode === "ranges" && p.sous_categories?.nom && (
                  <p className="text-[11px] text-brand truncate">{p.sous_categories.nom}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {!chargement && produits.length === 0 && !erreur && (
        <p className="text-center text-sm text-gray-400 py-10">
          {mode === "a_ranger" ? "Tous les articles de cette catégorie sont rangés. 🎉" : "Aucun article rangé pour le moment."}
        </p>
      )}
      {chargement && <p className="text-center text-sm text-gray-400 py-4">Chargement...</p>}
      {!chargement && produits.length < total && (
        <button
          onClick={() => charger(page + 1)}
          className="w-full sm:w-auto bg-white border border-gray-200 text-sm font-semibold rounded-md px-6 py-2.5"
        >
          Charger plus ({total - produits.length} restants)
        </button>
      )}
    </div>
  );
}
