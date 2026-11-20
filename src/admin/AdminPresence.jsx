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
    if (!navigator.geolocation) return reject(new Error("GPS_INDISPONIBLE"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error("GPS_INDISPONIBLE")),
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

// Lit une position dans un message WhatsApp (lien Google Maps, "lat,lng"...) collé par la personne.
function lirePositionCollee(texte) {
  let t = String(texte || "");
  try { t = decodeURIComponent(t); } catch { /* texte tel quel */ }
  const modeles = [
    /[?&](?:q|ll|query|destination|center)=\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/,
    /@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /(-?\d{1,2}\.\d{3,})\s*[,;\s]\s*(-?\d{1,3}\.\d{3,})/,
  ];
  for (const m of modeles) {
    const r = t.match(m);
    if (!r) continue;
    const lat = parseFloat(r[1]), lng = parseFloat(r[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  return null;
}


const fmtHeure = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const fmtDate = (iso) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

const ORANGE = "#F5720C";
const carte = { background: "#fff", borderRadius: 10, padding: 16, marginBottom: 16 };
const btnPlein = { background: ORANGE, color: "#fff", border: "none", borderRadius: 8, padding: "14px 28px", fontWeight: 700, fontSize: 15, cursor: "pointer" };
const btnContour = { width: "100%", background: "#fff", border: `2px solid ${ORANGE}`, color: ORANGE, borderRadius: 8, padding: "14px 0", fontWeight: 700, cursor: "pointer" };

export default function AdminPresence() {
  const [presence, setPresence] = useState(undefined); // undefined = chargement, null = pas encore aujourd'hui
  const [historique, setHistorique] = useState([]);
  const [enCours, setEnCours] = useState(false);
  const [etapeEnCours, setEtapeEnCours] = useState("");
  const [erreur, setErreur] = useState("");
  const [activites, setActivites] = useState("");
  const [difficultes, setDifficultes] = useState("");
  const [cible, setCible] = useState(null); // "debut" ou "fin" : pour quelle étape on cherche la position
  const [gpsEchec, setGpsEchec] = useState(false);
  const [texteColle, setTexteColle] = useState("");
  const [positionAConfirmer, setPositionAConfirmer] = useState(null); // { lat, lng, adresse, source }

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

  const annulerPosition = () => { setCible(null); setGpsEchec(false); setTexteColle(""); setPositionAConfirmer(null); setErreur(""); };

  // Étape 1 : localiser avec le GPS. S'il est refusé, on propose la position envoyée par WhatsApp.
  const localiser = async (pour) => {
    setErreur(""); setCible(pour); setGpsEchec(false); setEnCours(true);
    try {
      setEtapeEnCours("Localisation en cours...");
      const { lat, lng } = await obtenirPosition();
      setEtapeEnCours("Recherche du lieu...");
      const adresse = await obtenirAdresse(lat, lng);
      setPositionAConfirmer({ lat, lng, adresse, source: "gps" });
    } catch {
      setGpsEchec(true);
    }
    setEnCours(false); setEtapeEnCours("");
  };

  // Alternative : position collée depuis WhatsApp
  const validerPositionCollee = async () => {
    setErreur("");
    const pos = lirePositionCollee(texteColle);
    if (!pos) {
      setErreur(/goo\.gl|maps\.app/i.test(texteColle)
        ? "Ce lien raccourci ne peut pas être lu. Dans WhatsApp, envoyez « votre position actuelle » (et non un lieu choisi sur la carte), puis copiez ce message."
        : "Position non reconnue. Copiez bien le message de position envoyé depuis WhatsApp, puis collez-le ici.");
      return;
    }
    setEnCours(true); setEtapeEnCours("Recherche du lieu...");
    const adresse = await obtenirAdresse(pos.lat, pos.lng);
    setPositionAConfirmer({ ...pos, adresse, source: "whatsapp" });
    setGpsEchec(false);
    setEnCours(false); setEtapeEnCours("");
  };

  // Étape 2 : la personne a vu la carte et confirme (début ou fin de journée)
  const confirmerPosition = async () => {
    if (!positionAConfirmer) return;
    setErreur(""); setEnCours(true);
    try {
      const headers = await authHeaders();
      const debut = cible === "debut";
      const res = await fetch(`${API_URL}/api/presences/${debut ? "signer" : "cloturer"}`, {
        method: debut ? "POST" : "PUT", headers, body: JSON.stringify(positionAConfirmer),
      });
      const data = await res.json();
      if (!res.ok) { setErreur(data.error); setEnCours(false); return; }
      setPresence(data);
      annulerPosition();
      if (!debut) charger();
    } catch {
      setErreur("Impossible de contacter le serveur");
    }
    setEnCours(false);
  };

  // Rapport du jour (jusqu'à 23h59)
  const envoyerRapport = async (e) => {
    e.preventDefault();
    setErreur("");
    if (!activites.trim()) { setErreur("Décrivez les activités réalisées"); return; }
    setEnCours(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/api/presences/rapport`, {
        method: "PUT", headers, body: JSON.stringify({ activites, difficultes }),
      });
      const data = await res.json();
      if (!res.ok) { setErreur(data.error); setEnCours(false); return; }
      setPresence(data);
      setActivites(""); setDifficultes("");
      charger();
    } catch {
      setErreur("Impossible de contacter le serveur");
    }
    setEnCours(false);
  };

  if (erreur && presence === undefined) {
    return (
      <div style={{ maxWidth: 420 }}>
        <h1>Présence</h1>
        <p style={{ color: "red" }}>{erreur}</p>
        <button onClick={charger} style={{ background: ORANGE, color: "#fff", border: "none", borderRadius: 6, padding: "10px 20px", fontWeight: 600 }}>Réessayer</button>
      </div>
    );
  }
  if (presence === undefined) return <p>Chargement...</p>;

  const titrePosition = cible === "fin" ? "Clôturer la journée" : "Signer la présence";

  // Panneau « GPS impossible » : position envoyée par WhatsApp
  const panneauWhatsApp = gpsEchec && !positionAConfirmer && (
    <div style={{ ...carte, border: "1px solid #FFD9B8", background: "#FFF8F1" }}>
      <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 14 }}>📍 La localisation ne marche pas ?</p>
      <p style={{ margin: "0 0 10px", fontSize: 12, color: "#666" }}>Pas de souci, utilisez WhatsApp :</p>
      <ol style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 13, color: "#333", lineHeight: 1.6 }}>
        <li>Ouvrez WhatsApp, puis une conversation (par exemple avec vous-même).</li>
        <li>Touchez le trombone 📎 → <strong>Position</strong> → <strong>Envoyer votre position actuelle</strong>.</li>
        <li>Appuyez longuement sur le message de position envoyé → <strong>Copier</strong>.</li>
        <li>Revenez ici et collez-le dans la case ci-dessous.</li>
      </ol>
      <textarea value={texteColle} onChange={(e) => setTexteColle(e.target.value)} rows={3} placeholder="Collez ici le message de position copié depuis WhatsApp"
        style={{ width: "100%", boxSizing: "border-box", borderRadius: 6, border: "1px solid #ddd", padding: 8, fontSize: 13 }} />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={annulerPosition} style={{ flex: 1, background: "#eee", border: "none", borderRadius: 6, padding: "12px 0", cursor: "pointer" }}>Annuler</button>
        <button onClick={validerPositionCollee} disabled={enCours || !texteColle.trim()} style={{ flex: 2, background: ORANGE, color: "#fff", border: "none", borderRadius: 6, padding: "12px 0", fontWeight: 700, cursor: "pointer", opacity: !texteColle.trim() ? 0.5 : 1 }}>
          {enCours ? etapeEnCours : "Valider cette position"}
        </button>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 11, color: "#999" }}>Vous pouvez aussi réessayer le GPS après avoir autorisé la localisation dans les réglages du navigateur.</p>
    </div>
  );

  // Carte de confirmation (début ou fin)
  const panneauConfirmation = positionAConfirmer && (
    <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
      <iframe
        title="Votre position" width="100%" height="220" style={{ border: 0, display: "block" }}
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${positionAConfirmer.lng - 0.004}%2C${positionAConfirmer.lat - 0.004}%2C${positionAConfirmer.lng + 0.004}%2C${positionAConfirmer.lat + 0.004}&marker=${positionAConfirmer.lat}%2C${positionAConfirmer.lng}`}
      />
      <div style={{ padding: 16 }}>
        <p style={{ fontSize: 13, color: "#666", margin: "0 0 4px" }}>
          {positionAConfirmer.adresse || "Position repérée (adresse non trouvée)"}
        </p>
        {positionAConfirmer.source === "whatsapp" && <p style={{ fontSize: 11, color: "#999", margin: "0 0 8px" }}>Position reçue via WhatsApp</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={annulerPosition} disabled={enCours} style={{ flex: 1, background: "#eee", border: "none", borderRadius: 6, padding: "12px 0", cursor: "pointer" }}>Annuler</button>
          <button onClick={confirmerPosition} disabled={enCours} style={{ flex: 2, background: ORANGE, color: "#fff", border: "none", borderRadius: 6, padding: "12px 0", fontWeight: 700, cursor: "pointer" }}>
            {enCours ? "Enregistrement..." : titrePosition}
          </button>
        </div>
      </div>
    </div>
  );

  // Formulaire du rapport (affiché tant que le rapport du jour n'est pas envoyé)
  const formulaireRapport = presence && !presence.activites && (
    <form onSubmit={envoyerRapport} style={{ ...carte, display: "flex", flexDirection: "column", gap: 10 }}>
      <h3 style={{ margin: 0 }}>Rapport du jour</h3>
      <p style={{ margin: 0, fontSize: 12, color: "#D32F2F", fontWeight: 600 }}>À envoyer avant 23h59 ce soir. Après minuit, il ne sera plus possible.</p>
      <label style={{ fontSize: 13, color: "#666" }}>
        Activités réalisées
        <textarea value={activites} onChange={(e) => setActivites(e.target.value)} rows={4} required style={{ width: "100%", boxSizing: "border-box", marginTop: 4 }} />
      </label>
      <label style={{ fontSize: 13, color: "#666" }}>
        Difficultés rencontrées (optionnel)
        <textarea value={difficultes} onChange={(e) => setDifficultes(e.target.value)} rows={3} style={{ width: "100%", boxSizing: "border-box", marginTop: 4 }} />
      </label>
      <button type="submit" disabled={enCours} style={{ background: ORANGE, color: "#fff", border: "none", borderRadius: 6, padding: "12px 0", fontWeight: 700, cursor: "pointer" }}>
        {enCours ? "Envoi..." : "Envoyer le rapport"}
      </button>
    </form>
  );

  const rapportEnvoye = presence?.activites && (
    <div style={carte}>
      <p style={{ color: "#2E7D32", fontWeight: 700, marginTop: 0 }}>✓ Rapport du jour envoyé{presence.rapport_le ? ` à ${fmtHeure(presence.rapport_le)}` : ""}</p>
      <p style={{ fontSize: 13, whiteSpace: "pre-wrap" }}><strong>Activités :</strong> {presence.activites}</p>
      {presence.difficultes && <p style={{ fontSize: 13, whiteSpace: "pre-wrap", marginBottom: 0 }}><strong>Difficultés :</strong> {presence.difficultes}</p>}
    </div>
  );

  const enChoixPosition = cible && (gpsEchec || positionAConfirmer);

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ marginBottom: 4 }}>Présence</h1>
      <p style={{ color: "#999", fontSize: 13, marginTop: 0, textTransform: "capitalize" }}>{fmtDate(new Date().toISOString())}</p>

      {erreur && <p style={{ color: "red", fontSize: 13 }}>{erreur}</p>}

      {/* Début de journée */}
      {!presence && !enChoixPosition && (
        <div style={{ ...carte, padding: 24, textAlign: "center" }}>
          <p style={{ color: "#666", marginBottom: 16 }}>Vous n'avez pas encore commencé votre journée.</p>
          <button onClick={() => localiser("debut")} disabled={enCours} style={btnPlein}>{enCours ? etapeEnCours : "Commencer le travail"}</button>
        </div>
      )}
      {!presence && panneauWhatsApp}
      {!presence && panneauConfirmation}

      {/* Journée en cours */}
      {presence && !presence.heure_fin && (
        <>
          <div style={carte}>
            <p style={{ margin: "0 0 4px", color: "#2E7D32", fontWeight: 700 }}>✓ Journée commencée</p>
            <p style={{ margin: 0, fontSize: 13, color: "#666" }}>à {fmtHeure(presence.heure_debut)}</p>
            {presence.adresse_debut && <p style={{ margin: "8px 0 0", fontSize: 12, color: "#999" }}>📍 {presence.adresse_debut}</p>}
          </div>

          {panneauWhatsApp}
          {panneauConfirmation}

          {!enChoixPosition && (
            <div style={{ marginBottom: 16 }}>
              <button onClick={() => localiser("fin")} disabled={enCours} style={btnContour}>{enCours ? etapeEnCours : "Clôturer la journée (ma position)"}</button>
              <p style={{ fontSize: 11, color: "#999", margin: "6px 0 0" }}>Clôturer = enregistrer votre position en fin de journée. Le rapport s'envoie séparément, jusqu'à 23h59.</p>
            </div>
          )}

          {rapportEnvoye}
          {formulaireRapport}
        </>
      )}

      {/* Journée clôturée */}
      {presence && presence.heure_fin && (
        <>
          <div style={carte}>
            <p style={{ color: "#2E7D32", fontWeight: 700, marginTop: 0 }}>✓ Journée clôturée</p>
            <p style={{ fontSize: 13, color: "#666", margin: "0 0 6px" }}>{fmtHeure(presence.heure_debut)} → {fmtHeure(presence.heure_fin)}</p>
            {presence.adresse_fin && <p style={{ fontSize: 12, color: "#999", margin: 0 }}>📍 Fin : {presence.adresse_fin}</p>}
            <p style={{ fontSize: 12, color: "#999", marginBottom: 0 }}>Le bouton "Commencer le travail" reviendra demain.</p>
          </div>
          {rapportEnvoye}
          {formulaireRapport}
        </>
      )}

      {/* Historique des jours précédents */}
      {historique.filter((p) => p.date !== presence?.date).length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3>Historique de mes jours de travail</h3>
          <p style={{ color: "#999", fontSize: 12, marginTop: -6 }}>{historique.length} jour{historique.length > 1 ? "s" : ""} au total</p>
          <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden" }}>
            {historique.filter((p) => p.date !== presence?.date).map((p) => (
              <div key={p.id} style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 13, textTransform: "capitalize" }}>{fmtDate(p.date + "T12:00:00")}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#666" }}>
                  {fmtHeure(p.heure_debut)} → {p.heure_fin ? fmtHeure(p.heure_fin) : "non clôturée"}
                  {!p.activites && <span style={{ color: "#D32F2F", fontWeight: 600 }}> · rapport manquant</span>}
                </p>
                {p.activites && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#444", whiteSpace: "pre-wrap" }}><strong>Activités :</strong> {p.activites}</p>}
                {p.difficultes && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#444", whiteSpace: "pre-wrap" }}><strong>Difficultés :</strong> {p.difficultes}</p>}
                {p.adresse_debut && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#999" }}>📍 {p.adresse_debut}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
