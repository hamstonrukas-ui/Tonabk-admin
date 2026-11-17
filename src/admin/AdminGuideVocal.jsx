// Audios du guide de bienvenue du site (3 écrans) : on envoie ou on enregistre la voix, comme pour l'audio des soldes.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";
import EnregistreurVoix from "./EnregistreurVoix";

const ECRANS = [
  { n: "1", icone: "🛍️", titre: "Choisissez un rayon", texte: "Chemises, robes, souliers… Touchez une catégorie, puis le type de produit qui vous intéresse." },
  { n: "2", icone: "💬", titre: "Écrivez au vendeur", texte: "Touchez un article, puis le bouton WhatsApp pour parler au vendeur. Ou touchez « Livre-moi » : on vous livre à la maison." },
  { n: "3", icone: "🔎", titre: "Vous ne trouvez pas ?", texte: "Dites-nous ce que vous cherchez avec le bouton « Demander » : on le cherche pour vous." },
];

const AIDES_PAGES = [
  { n: "accueil", icone: "🏠", titre: "Accueil", texte: "Touchez une catégorie en haut (Habillement, Smartphones…), puis le type de produit. Touchez un article pour le voir. Le bouton « Voir en mode TikTok » fait défiler les produits comme une vidéo. Le bouton rond orange rafraîchit la page." },
  { n: "rayon", icone: "👕", titre: "Un rayon (ex. Chemises)", texte: "Voici les articles de ce rayon. Touchez « Voir en mode TikTok » pour les faire défiler, ou « Partager » pour envoyer ce rayon à un ami sur WhatsApp." },
  { n: "produit", icone: "📦", titre: "Fiche d'un produit", texte: "Glissez la photo pour en voir d'autres. Touchez « WhatsApp » pour écrire au vendeur, ou « Livre-moi à la maison » pour qu'on vous livre. Le bouton vert en haut à droite partage ce produit." },
  { n: "boutiques", icone: "🏬", titre: "Liste des boutiques", texte: "Choisissez une catégorie pour voir les boutiques, puis touchez une boutique pour voir tous ses articles." },
  { n: "boutique", icone: "🏪", titre: "Une boutique", texte: "Voici le catalogue de cette boutique. Touchez un article pour le voir de plus près et écrire au vendeur." },
  { n: "soldes", icone: "🔥", titre: "Soldes", texte: "Ce sont les offres du moment à prix réduit. Touchez une offre pour voir les photos et le prix, puis contactez-nous pour l'avoir." },
  { n: "mali_mupya", icone: "✨", titre: "Mali mupya", texte: "Ce sont les nouveautés publiées par les boutiques, visibles 48 heures. Touchez une photo pour la voir en grand, glissez pour voir les suivantes, et touchez « Livre-moi » pour commander." },
  { n: "kisakoshi", icone: "💼", titre: "Kisakoshi", texte: "Un Kisakoshi, c'est une valise : plusieurs articles ensemble pour un seul prix. Touchez-en un pour voir les photos et contacter le vendeur." },
  { n: "requete", icone: "🔎", titre: "Requêtes", texte: "Vous cherchez un produit introuvable ? Décrivez-le ici : des vendeurs pourront vous répondre." },
  { n: "location", icone: "🏠", titre: "Location de maisons", texte: "Trouvez une maison à louer par quartier. Touchez une maison pour voir les photos et contacter le propriétaire." },
  { n: "commandes", icone: "🚚", titre: "Commandes", texte: "Vous retrouvez ici vos demandes de livraison. Touchez-en une pour reprendre la conversation sur WhatsApp." },
  { n: "panier", icone: "🧺", titre: "Panier", texte: "Vérifiez vos articles puis envoyez votre commande." },
];

async function entetes(json) {
  const { data: { session } } = await supabase.auth.getSession();
  const h = { Authorization: `Bearer ${session?.access_token}` };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

function Carte({ ecran, actuel, onChange }) {
  const [fichier, setFichier] = useState(null);
  const [cleEnr, setCleEnr] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");

  async function enregistrer() {
    if (!fichier) return;
    setEnvoi(true); setErreur(""); setMessage("");
    try {
      const fd = new FormData();
      fd.append("audio", fichier);
      const up = await fetch(`${API_URL}/api/upload/audio-guide`, { method: "POST", headers: await entetes(false), body: fd });
      const d = await up.json().catch(() => ({}));
      if (!up.ok) throw new Error(d.error || "Échec de l'envoi de l'audio");
      const put = await fetch(`${API_URL}/api/guide/audio/${ecran.n}`, { method: "PUT", headers: await entetes(true), body: JSON.stringify({ url: d.url }) });
      const r = await put.json().catch(() => ({}));
      if (!put.ok) throw new Error(r.error || "Échec de l'enregistrement");
      onChange(r.audios);
      setFichier(null); setCleEnr((k) => k + 1);
      setMessage("✓ Audio enregistré");
    } catch (e) { setErreur(e.message); }
    setEnvoi(false);
  }

  async function retirer() {
    if (!window.confirm("Retirer l'audio de cet écran ?")) return;
    setErreur(""); setMessage("");
    const res = await fetch(`${API_URL}/api/guide/audio/${ecran.n}`, { method: "DELETE", headers: await entetes(false) });
    const r = await res.json().catch(() => ({}));
    if (!res.ok) return setErreur(r.error || "Échec");
    onChange(r.audios);
  }

  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: 14, maxWidth: 560, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontWeight: 700 }}>{ecran.icone} {/^\d$/.test(ecran.n) ? `Écran ${ecran.n} — ` : "Page : "}{ecran.titre}</div>
      <div style={{ fontSize: 13, color: "#555", background: "#FFF8F2", borderRadius: 6, padding: 8 }}>
        À lire à voix haute : « {/^\d$/.test(ecran.n) ? `${ecran.titre}. ` : ""}{ecran.texte} »
      </div>
      {actuel ? (
        <>
          <audio src={actuel} controls style={{ width: "100%" }} />
          <button type="button" onClick={retirer} style={{ color: "red", background: "none", border: "none", fontSize: 12, textAlign: "left" }}>Retirer cet audio</button>
        </>
      ) : <span style={{ fontSize: 12, color: "#999" }}>Aucun audio pour l'instant.</span>}

      {fichier ? (
        <div style={{ fontSize: 13 }}>
          <span style={{ color: "#2E7D32", fontWeight: 600 }}>✓ {fichier.name}</span>{" "}
          <button type="button" onClick={() => { setFichier(null); setCleEnr((k) => k + 1); }} style={{ color: "red", background: "none", border: "none", fontSize: 12 }}>Annuler</button>
        </div>
      ) : (
        <input type="file" accept="audio/*" onChange={(e) => { setFichier(e.target.files?.[0] || null); e.target.value = ""; }} />
      )}
      <EnregistreurVoix key={cleEnr} onPret={setFichier} />

      <button type="button" onClick={enregistrer} disabled={!fichier || envoi}
        style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "9px 0", fontWeight: 600, opacity: !fichier || envoi ? 0.5 : 1 }}>
        {envoi ? "Envoi..." : actuel ? "Remplacer l'audio" : "Enregistrer l'audio"}
      </button>
      {message && <span style={{ color: "#2E7D32", fontSize: 13 }}>{message}</span>}
      {erreur && <span style={{ color: "red", fontSize: 13 }}>{erreur}</span>}
    </div>
  );
}

export default function AdminGuideVocal() {
  const [audios, setAudios] = useState({});
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/api/guide`, { cache: "no-store" }).then((r) => r.json()).then((d) => setAudios(d.audios || {}))
      .catch(() => setErreur("Impossible de charger les audios"));
  }, []);

  return (
    <div>
      <h1>Guide vocal</h1>
      <p style={{ fontSize: 13, color: "#666", maxWidth: 600 }}>
        Quand un client ouvre le guide « Comment ça marche ? » sur le site, un bouton « Écouter » lit la voix enregistrée ici.
        Une personne lit chaque texte, vous l'envoyez ou l'enregistrez : 3 audios au total, de moins d'une minute chacun.
      </p>
      {erreur && <p style={{ color: "red", fontSize: 13 }}>{erreur}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {ECRANS.map((e) => <Carte key={e.n} ecran={e} actuel={audios[e.n]} onChange={setAudios} />)}
      </div>

      <h2 style={{ marginTop: 28 }}>Aide de chaque page</h2>
      <p style={{ fontSize: 13, color: "#666", maxWidth: 600 }}>
        Sur chaque page du site, un petit bouton « ? » ouvre une aide. Si vous ajoutez un audio ici, un bouton « Écouter » apparaît dans cette aide.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {AIDES_PAGES.map((e) => <Carte key={e.n} ecran={e} actuel={audios[e.n]} onChange={setAudios} />)}
      </div>
    </div>
  );
}
