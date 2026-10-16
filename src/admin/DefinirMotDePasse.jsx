import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { API_URL } from "../lib/api";

export default function DefinirMotDePasse() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [nom, setNom] = useState("");
  const [verification, setVerification] = useState("en-cours"); // en-cours | ok | invalide
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [termine, setTermine] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/personnel/invitation/${token}`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) { setVerification("invalide"); setErreur(data.error); return; }
        setNom(data.nom);
        setVerification("ok");
      })
      .catch(() => { setVerification("invalide"); setErreur("Impossible de contacter le serveur"); });
  }, [token]);

  const valider = async (e) => {
    e.preventDefault();
    setErreur("");
    if (motDePasse.length < 6) { setErreur("Le mot de passe doit faire au moins 6 caractères"); return; }
    if (motDePasse !== confirmation) { setErreur("Les mots de passe ne correspondent pas"); return; }

    setEnvoiEnCours(true);
    try {
      const res = await fetch(`${API_URL}/api/personnel/invitation/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motDePasse }),
      });
      const data = await res.json();
      if (!res.ok) { setErreur(data.error || "Échec de l'enregistrement"); setEnvoiEnCours(false); return; }
      setTermine(true);
      setTimeout(() => navigate("/connexion"), 2500);
    } catch {
      setErreur("Impossible de contacter le serveur");
    }
    setEnvoiEnCours(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F3F3F3" }}>
      <div style={{ background: "#fff", borderRadius: 10, padding: 24, width: "100%", maxWidth: 360 }}>
        <h2 style={{ color: "#F5720C", marginTop: 0 }}>TonaBk Admin</h2>

        {verification === "en-cours" && <p>Vérification du lien...</p>}

        {verification === "invalide" && (
          <>
            <p style={{ color: "red", fontSize: 13 }}>{erreur}</p>
            <p style={{ fontSize: 13, color: "#666" }}>Demandez un nouveau lien à l'administrateur.</p>
          </>
        )}

        {verification === "ok" && !termine && (
          <form onSubmit={valider} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 13, color: "#666" }}>
              Bienvenue {nom} — choisissez votre mot de passe pour accéder au tableau de bord.
            </p>
            {erreur && <p style={{ color: "red", fontSize: 13 }}>{erreur}</p>}
            <input
              type="password" placeholder="Nouveau mot de passe" value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)} required minLength={6}
            />
            <input
              type="password" placeholder="Confirmer le mot de passe" value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)} required minLength={6}
            />
            <button type="submit" disabled={envoiEnCours} style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "12px 0", fontWeight: 600 }}>
              {envoiEnCours ? "Enregistrement..." : "Définir le mot de passe"}
            </button>
          </form>
        )}

        {termine && (
          <>
            <p style={{ color: "#2E7D32", fontWeight: 600 }}>Mot de passe défini !</p>
            <p style={{ fontSize: 13, color: "#666" }}>
              Redirection vers la connexion... <Link to="/connexion">cliquez ici</Link> si rien ne se passe.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
