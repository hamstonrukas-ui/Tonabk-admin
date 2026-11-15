// Enregistre la voix au micro puis la transforme en voix de femme ou d'homme.
// L'enregistrement d'origine reste dans le navigateur et n'est jamais envoyé : seul l'audio transformé
// est transmis au formulaire (onPret).
import { useEffect, useRef, useState } from "react";
import { transformerEnregistrement } from "../lib/voix";

const DUREE_MAX_S = 60;
const INTENSITES = [
  { cle: "leger", texte: "Léger", demitons: 3 },
  { cle: "moyen", texte: "Moyen", demitons: 5 },
  { cle: "fort", texte: "Fort", demitons: 7 },
];

const bouton = { border: "1px solid #F5720C", color: "#F5720C", background: "#fff", borderRadius: 6, padding: "6px 12px", fontWeight: 600, fontSize: 13 };

export default function EnregistreurVoix({ onPret }) {
  const [etat, setEtat] = useState("repos"); // repos | enregistre | pret
  const [secondes, setSecondes] = useState(0);
  const [genre, setGenre] = useState("femme");
  const [intensite, setIntensite] = useState("moyen");
  const [traitement, setTraitement] = useState(false);
  const [apercuUrl, setApercuUrl] = useState(null);
  const [erreur, setErreur] = useState("");

  const originalRef = useRef(null); // enregistrement d'origine : gardé en mémoire seulement
  const recorderRef = useRef(null);
  const flux = useRef(null);
  const minuteur = useRef(null);
  const numero = useRef(0); // évite qu'un ancien traitement écrase le plus récent

  const arreterMicro = () => {
    clearInterval(minuteur.current);
    flux.current?.getTracks().forEach((t) => t.stop());
    flux.current = null;
  };
  useEffect(() => () => { arreterMicro(); }, []);
  useEffect(() => () => { if (apercuUrl) URL.revokeObjectURL(apercuUrl); }, [apercuUrl]);

  const appliquer = async (g, i) => {
    if (!originalRef.current) return;
    const id = ++numero.current;
    setTraitement(true);
    setErreur("");
    try {
      const signe = g === "femme" ? 1 : -1;
      const demitons = signe * INTENSITES.find((x) => x.cle === i).demitons;
      const wav = await transformerEnregistrement(originalRef.current, demitons);
      if (id !== numero.current) return;
      setApercuUrl(URL.createObjectURL(wav));
      onPret(new File([wav], `annonce-voix-${g}.wav`, { type: "audio/wav" }));
    } catch {
      if (id === numero.current) setErreur("Impossible de transformer cet enregistrement. Réessayez.");
    }
    if (id === numero.current) setTraitement(false);
  };

  const demarrer = async () => {
    setErreur("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return setErreur("L'enregistrement n'est pas pris en charge sur ce navigateur.");
    }
    try {
      flux.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return setErreur("Micro refusé : autorisez le micro pour ce site dans le navigateur.");
    }
    const morceaux = [];
    const rec = new MediaRecorder(flux.current);
    rec.ondataavailable = (e) => { if (e.data.size) morceaux.push(e.data); };
    rec.onstop = () => {
      arreterMicro();
      originalRef.current = new Blob(morceaux, { type: rec.mimeType || "audio/webm" });
      setEtat("pret");
      appliquer(genre, intensite);
    };
    recorderRef.current = rec;
    rec.start();
    setSecondes(0);
    setEtat("enregistre");
    minuteur.current = setInterval(() => {
      setSecondes((s) => {
        if (s + 1 >= DUREE_MAX_S) rec.state !== "inactive" && rec.stop();
        return s + 1;
      });
    }, 1000);
  };

  const arreter = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  };

  const recommencer = () => {
    numero.current++;
    originalRef.current = null;
    setApercuUrl(null);
    setTraitement(false);
    setEtat("repos");
    onPret(null);
  };

  const choisir = (g, i) => {
    setGenre(g);
    setIntensite(i);
    appliquer(g, i);
  };

  return (
    <div style={{ marginTop: 8, borderTop: "1px dashed #ddd", paddingTop: 8 }}>
      <p style={{ margin: "0 0 6px", fontSize: 12, color: "#666", fontWeight: 600 }}>🎙️ Ou enregistrer directement avec une autre voix</p>

      {etat === "repos" && <button type="button" onClick={demarrer} style={bouton}>● Enregistrer</button>}

      {etat === "enregistre" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "red", fontWeight: 700, fontSize: 13 }}>● {secondes}s / {DUREE_MAX_S}s</span>
          <button type="button" onClick={arreter} style={{ ...bouton, background: "#F5720C", color: "#fff" }}>■ Arrêter</button>
        </div>
      )}

      {etat === "pret" && (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            {[["femme", "Voix de femme"], ["homme", "Voix d'homme"]].map(([g, t]) => (
              <button key={g} type="button" onClick={() => choisir(g, intensite)} disabled={traitement}
                style={{ ...bouton, background: genre === g ? "#F5720C" : "#fff", color: genre === g ? "#fff" : "#F5720C" }}>
                {t}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12 }}>
            <span style={{ color: "#666" }}>Intensité :</span>
            {INTENSITES.map((x) => (
              <button key={x.cle} type="button" onClick={() => choisir(genre, x.cle)} disabled={traitement}
                style={{ border: "1px solid #ddd", borderRadius: 999, padding: "2px 10px", background: intensite === x.cle ? "#1B1B1B" : "#fff", color: intensite === x.cle ? "#fff" : "#444", fontSize: 12 }}>
                {x.texte}
              </button>
            ))}
          </div>
          {traitement && <p style={{ margin: "4px 0", fontSize: 12, color: "#999" }}>Transformation de la voix...</p>}
          {apercuUrl && !traitement && <audio src={apercuUrl} controls style={{ width: "100%" }} />}
          <p style={{ margin: "4px 0", fontSize: 11, color: "#999" }}>Votre voix d'origine n'est pas conservée : seul cet audio transformé sera enregistré.</p>
          <button type="button" onClick={recommencer} style={{ background: "none", border: "none", color: "red", fontSize: 12, padding: 0 }}>Recommencer l'enregistrement</button>
        </div>
      )}

      {erreur && <p style={{ color: "red", fontSize: 12, margin: "6px 0 0" }}>{erreur}</p>}
    </div>
  );
}
