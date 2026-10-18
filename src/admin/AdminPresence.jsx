import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` };
}

// Position GPS du téléphone.
function obtenirPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Géolocalisation non disponible sur cet appareil"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error("Position refusée — autorisez la géolocalisation pour continuer")),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

// Adresse générale du point (rue/quartier) — service gratuit OpenStreetMap.
async function obtenirAdresseGenerale(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`,
      { headers: { "Accept-Language": "fr" } }
    );
    const data = await res.json();
    return data?.display_name || null;
  } catch {
    return null;
  }
}

// Institutions/repères nommés dans un rayon de 250m (pharmacies, écoles, marchés,
// bureaux, églises...) — preuve de terrain plus parlante qu'une simple adresse.
// Overpass (OpenStreetMap), gratuit, sans clé.
async function obtenirReperesProches(lat, lng) {
  const requete = `
    [out:json][timeout:12];
    (
      node(around:250,${lat},${lng})[name][amenity];
      node(around:250,${lat},${lng})[name][shop];
      node(around:250,${lat},${lng})[name][office];
    );
    out body 6;
  `;
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: requete,
    });
    const data = await res.json();
    const noms = (data.elements || [])
      .map((e) => e.tags?.name)
      .filter(Boolean);
    return [...new Set(noms)].slice(0, 5);
  } catch {
    return [];
  }
}

// Combine adresse générale + repères proches en un seul texte à enregistrer.
async function obtenirAdresse(lat, lng) {
  const [adresse, reperes] = await Promise.all([
    obtenirAdresseGenerale(lat, lng),
    obtenirReperesProches(lat, lng),
  ]);
  const partieReperes = reperes.length ? `Près de : ${reperes.join(", ")}` : "";
  return [partieReperes, adresse].filter(Boolean).join(" — ") || null;
}

const fmtHeure = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const fmtDate = (iso) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function AdminPresence() {
  const [presence, setPresence] = useState(undefined); // undefined = chargement, null = pas encore aujourd'hui
  const [historique, setHistorique] = useState([]);
  const [enCours, setEnCours] = useState(false);
  const [etapeEnCours, setEtapeEnCours] = useState(""); // texte affiché pendant la localisation
  const [erreur, setErreur] = useState("");
  const [activites, setActivites] = useState("");
  const [difficultes, setDifficultes] = useState("");
  const [afficherCloture, setAfficherCloture] = useState(false);
  const [positionAConfirmer, setPositionAConfirmer] = useState(null); // { lat, lng, adresse }

  async function charger() {
    setErreur("");
    try {
      const headers = await authHeaders();
      const [resAuj, resHisto] = await Promise.all([
        fetch(`${API_URL}/api/presences/aujourdhui`, { headers }),
        fetch(`${API_URL}/api/presences/mon-historique`, { headers }),
      ]);
      if (resAuj.ok) setPresence(await resAuj.json());
      else setErreur((await resAuj.json().catch(() => ({}))).error || `Erreur ${resAuj.status}`);

      if (resHisto.ok) setHistorique(await resHisto.json());
    } catch {
      setErreur("Impossible de contacter le serveur");
    }
  }

  useEffect(() => { charger(); }, []);

  // Étape 1 : localiser et montrer la carte, sans encore rien enregistrer.
  const localiser = async () => {
    setErreur("");
    setEnCours(true);
    try {
      setEtapeEnCours("Localisation en cours...");
      const { lat, lng } = await obtenirPosition();
      setEtapeEnCours("Recherche du lieu...");
      const adresse = await obtenirAdresse(lat, lng);
      setPositionAConfirmer({ lat, lng, adresse });
    } catch (err) {
      setErreur(err.message);
    }
    setEnCours(false);
    setEtapeEnCours("");
  };

  // Étape 2 : la personne a vu la carte et confirme.
  const signer = async () => {
    if (!positionAConfirmer) return;
    setErreur("");
    setEnCours(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/api/presences/signer`, {
        method: "POST", headers, body: JSON.stringify(positionAConfirmer),
      });
      const data = await res.json();
      if (!res.ok) { setErreur(data.error); setEnCours(false); return; }
      setPresence(data);
      setPositionAConfirmer(null);
    } catch {
      setErreur("Impossible de contacter le serveur");
    }
    setEnCours(false);
  };

  const cloturer = async (e) => {
    e.preventDefault();
    setErreur("");
    if (!activites.trim()) { setErreur("Décrivez les activités réalisées"); return; }

    setEnCours(true);
    let lat = null, lng = null, adresse = null;
    try {
      setEtapeEnCours("Localisation en cours...");
      const position = await obtenirPosition();
      lat = position.lat; lng = position.lng;
      adresse = await obtenirAdresse(lat, lng);
    } catch {
      // La position est optionnelle à la clôture : on continue sans si refusée/indisponible.
    }

    try {
      setEtapeEnCours("Enregistrement...");
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/api/presences/cloturer`, {
        method: "PUT", headers,
        body: JSON.stringify({ lat, lng, adresse, activites, difficultes }),
      });
      const data = await res.json();
      if (!res.ok) { setErreur(data.error); setEnCours(false); setEtapeEnCours(""); return; }
      setPresence(data);
      setAfficherCloture(false);
      charger(); // rafraîchit aussi l'historique
    } catch {
      setErreur("Impossible de contacter le serveur");
    }
    setEnCours(false);
    setEtapeEnCours("");
  };

  if (erreur && presence === undefined) {
    return (
      <div style={{ maxWidth: 420 }}>
        <h1>Présence</h1>
        <p style={{ color: "red" }}>{erreur}</p>
        <button onClick={charger} style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "10px 20px", fontWeight: 600 }}>
          Réessayer
        </button>
      </div>
    );
  }

  if (presence === undefined) return <p>Chargement...</p>;

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ marginBottom: 4 }}>Présence</h1>
      <p style={{ color: "#999", fontSize: 13, marginTop: 0, textTransform: "capitalize" }}>{fmtDate(new Date().toISOString())}</p>

      {erreur && <p style={{ color: "red", fontSize: 13 }}>{erreur}</p>}

      {/* Aucune présence aujourd'hui, et pas encore de position repérée */}
      {!presence && !positionAConfirmer && (
        <div style={{ background: "#fff", borderRadius: 10, padding: 24, textAlign: "center" }}>
          <p style={{ color: "#666", marginBottom: 16 }}>Vous n'avez pas encore commencé votre journée.</p>
          <button onClick={localiser} disabled={enCours} style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 8, padding: "14px 28px", fontWeight: 700, fontSize: 15 }}>
            {enCours ? etapeEnCours : "Commencer le travail"}
          </button>
        </div>
      )}

      {/* Position repérée : on montre la carte avant de signer pour de vrai */}
      {!presence && positionAConfirmer && (
        <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden" }}>
          <iframe
            title="Votre position"
            width="100%"
            height="220"
            style={{ border: 0, display: "block" }}
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${positionAConfirmer.lng - 0.004}%2C${positionAConfirmer.lat - 0.004}%2C${positionAConfirmer.lng + 0.004}%2C${positionAConfirmer.lat + 0.004}&marker=${positionAConfirmer.lat}%2C${positionAConfirmer.lng}`}
          />
          <div style={{ padding: 16 }}>
            <p style={{ fontSize: 13, color: "#666", margin: "0 0 12px" }}>
              {positionAConfirmer.adresse || "Position repérée (adresse non trouvée)"}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setPositionAConfirmer(null)} disabled={enCours} style={{ flex: 1, background: "#eee", border: "none", borderRadius: 6, padding: "12px 0" }}>
                Annuler
              </button>
              <button onClick={signer} disabled={enCours} style={{ flex: 2, background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "12px 0", fontWeight: 700 }}>
                {enCours ? "Signature..." : "Signer la présence"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Journée en cours */}
      {presence && !presence.heure_fin && (
        <>
          <div style={{ background: "#fff", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <p style={{ margin: "0 0 4px", color: "#2E7D32", fontWeight: 700 }}>✓ Journée commencée</p>
            <p style={{ margin: 0, fontSize: 13, color: "#666" }}>à {fmtHeure(presence.heure_debut)}</p>
            {presence.adresse_debut && (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#999" }}>📍 {presence.adresse_debut}</p>
            )}
          </div>

          {!afficherCloture ? (
            <button
              onClick={() => setAfficherCloture(true)}
              style={{ width: "100%", background: "#fff", border: "2px solid #F5720C", color: "#F5720C", borderRadius: 8, padding: "14px 0", fontWeight: 700 }}
            >
              Clôturer la journée
            </button>
          ) : (
            <form onSubmit={cloturer} style={{ background: "#fff", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <h3 style={{ margin: 0 }}>Clôturer la journée</h3>
              <label style={{ fontSize: 13, color: "#666" }}>
                Activités réalisées
                <textarea value={activites} onChange={(e) => setActivites(e.target.value)} rows={3} required style={{ width: "100%", marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 13, color: "#666" }}>
                Difficultés rencontrées (optionnel)
                <textarea value={difficultes} onChange={(e) => setDifficultes(e.target.value)} rows={3} style={{ width: "100%", marginTop: 4 }} />
              </label>
              <p style={{ fontSize: 11, color: "#999", margin: 0 }}>
                La position sera reprise si vous l'autorisez (facultatif à cette étape).
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => setAfficherCloture(false)} style={{ flex: 1, background: "#eee", border: "none", borderRadius: 6, padding: "12px 0" }}>
                  Annuler
                </button>
                <button type="submit" disabled={enCours} style={{ flex: 2, background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "12px 0", fontWeight: 700 }}>
                  {enCours ? etapeEnCours : "Envoyer et clôturer"}
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {/* Journée déjà clôturée : récap, et on repartira à zéro demain */}
      {presence && presence.heure_fin && (
        <div style={{ background: "#fff", borderRadius: 10, padding: 16 }}>
          <p style={{ color: "#2E7D32", fontWeight: 700, marginTop: 0 }}>✓ Journée clôturée</p>
          <p style={{ fontSize: 13, color: "#666", margin: "0 0 10px" }}>
            {fmtHeure(presence.heure_debut)} → {fmtHeure(presence.heure_fin)}
          </p>
          <p style={{ fontSize: 13 }}><strong>Activités :</strong> {presence.activites}</p>
          {presence.difficultes && <p style={{ fontSize: 13 }}><strong>Difficultés :</strong> {presence.difficultes}</p>}
          {presence.adresse_fin && <p style={{ fontSize: 12, color: "#999" }}>📍 Fin : {presence.adresse_fin}</p>}
          <p style={{ fontSize: 12, color: "#999", marginBottom: 0 }}>Le bouton "Commencer le travail" reviendra demain.</p>
        </div>
      )}

      {/* Historique des jours précédents */}
      {historique.length > 1 && (
        <div style={{ marginTop: 28 }}>
          <h3>Historique</h3>
          <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden" }}>
            {historique
              .filter((p) => p.date !== presence?.date)
              .map((p) => (
                <div key={p.id} style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 13, textTransform: "capitalize" }}>{fmtDate(p.date)}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#666" }}>
                    {fmtHeure(p.heure_debut)} → {p.heure_fin ? fmtHeure(p.heure_fin) : "non clôturée"}
                  </p>
                  {p.activites && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#999" }}>{p.activites}</p>}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
