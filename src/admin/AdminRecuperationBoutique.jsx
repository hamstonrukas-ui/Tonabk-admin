import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` };
}

export default function AdminRecuperationBoutique() {
  const [telephone, setTelephone] = useState("");
  const [code, setCode] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const genererCode = async (e) => {
    e.preventDefault();
    setErreur("");
    setCode(null);
    if (!telephone.trim()) { setErreur("Numéro requis"); return; }

    setEnvoiEnCours(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/api/recuperation-boutique/generer-code`, {
        method: "POST", headers, body: JSON.stringify({ telephone }),
      });
      const data = await res.json();
      if (!res.ok) { setErreur(data.error || "Échec de la génération"); setEnvoiEnCours(false); return; }
      setCode(data.code);
    } catch {
      setErreur("Erreur de connexion");
    }
    setEnvoiEnCours(false);
  };

  return (
    <div>
      <h1>Récupération de boutique</h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
        Quand un commerçant vous écrit sur WhatsApp pour récupérer l'accès à sa boutique, entrez
        son numéro ici, puis copiez-collez le code généré dans votre réponse WhatsApp. Valable 30 minutes.
      </p>

      <form onSubmit={genererCode} style={{ background: "#fff", borderRadius: 10, padding: 16, maxWidth: 380, display: "flex", flexDirection: "column", gap: 10 }}>
        {erreur && <p style={{ color: "red", fontSize: 13 }}>{erreur}</p>}
        <input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Numéro WhatsApp du commerçant" required />
        <button type="submit" disabled={envoiEnCours} style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "10px 0", fontWeight: 600 }}>
          {envoiEnCours ? "Génération..." : "Générer un code"}
        </button>

        {code && (
          <div style={{ background: "#FFF8F2", border: "1px solid #F5720C66", borderRadius: 8, padding: 14, textAlign: "center" }}>
            <p style={{ fontSize: 11, color: "#666", margin: "0 0 6px" }}>Code à envoyer sur WhatsApp :</p>
            <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: 4, margin: 0, color: "#F5720C" }}>{code}</p>
          </div>
        )}
      </form>
    </div>
  );
}
