import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";
import { useRole } from "./RoleContext";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` };
}

const fmt = (n, devise = "USD") => Number(n).toLocaleString("fr-FR") + " " + devise;
const LIBELLES = { en_attente: "En attente", acceptee: "Assignée", en_route: "En route", livree: "Livrée", annulee: "Annulée" };

export default function AdminLivraisons() {
  const complet = useRole() === "admin";
  const [livraisons, setLivraisons] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [erreur, setErreur] = useState("");
  const [partage, setPartage] = useState(false);
  const [choix, setChoix] = useState({}); // livreur choisi (pas encore validé) pour chaque commande
  const [enCours, setEnCours] = useState(null); // commande en cours d'assignation
  const [message, setMessage] = useState("");
  const watchId = useRef(null);
  const dernierEnvoi = useRef(0);
  const livraisonsRef = useRef([]);
  livraisonsRef.current = livraisons;

  async function charger() {
    setErreur("");
    try {
      const headers = await authHeaders();
      const url = complet ? `${API_URL}/api/livraisons` : `${API_URL}/api/livraisons/livreur/mes-livraisons`;
      const res = await fetch(url, { headers });
      if (res.ok) setLivraisons(await res.json());
      else setErreur((await res.json().catch(() => ({}))).error || `Erreur ${res.status}`);

      if (complet) {
        const resP = await fetch(`${API_URL}/api/personnel`, { headers });
        if (resP.ok) setPersonnel(await resP.json());
      }
    } catch {
      setErreur("Impossible de contacter le serveur");
    }
  }

  useEffect(() => {
    charger();
    const t = setInterval(charger, 15000);
    return () => { clearInterval(t); arreterPartage(); };
  }, []);

  const assigner = async (id) => {
    const livreur_id = choix[id];
    if (!livreur_id) return;
    setEnCours(id);
    setMessage("");
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/api/livraisons/${id}/assigner`, {
        method: "PUT", headers, body: JSON.stringify({ livreur_id }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Erreur ${res.status}`);
      setChoix((c) => { const n = { ...c }; delete n[id]; return n; });
      await charger();
      setMessage("Livreur assigné.");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  };

  const changerStatut = async (id, statut) => {
    const headers = await authHeaders();
    await fetch(`${API_URL}/api/livraisons/${id}/statut`, { method: "PUT", headers, body: JSON.stringify({ statut }) });
    if (statut === "en_route") demarrerPartage();
    charger();
  };

  // Position GPS en direct : envoyée toutes les ~8 s pour chaque course "en route"
  function demarrerPartage() {
    if (watchId.current != null || !navigator.geolocation) return;
    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const maintenant = Date.now();
        if (maintenant - dernierEnvoi.current < 8000) return;
        dernierEnvoi.current = maintenant;
        const headers = await authHeaders();
        const enRoute = livraisonsRef.current.filter((l) => l.statut === "en_route");
        enRoute.forEach((l) =>
          fetch(`${API_URL}/api/livraisons/${l.id}/position`, {
            method: "PUT", headers,
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          })
        );
      },
      () => setErreur("Position refusée — autorisez la géolocalisation pour être suivi par le client"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    setPartage(true);
  }
  function arreterPartage() {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setPartage(false);
  }

  useEffect(() => {
    if (!complet && livraisons.some((l) => l.statut === "en_route")) demarrerPartage();
    if (!livraisons.some((l) => l.statut === "en_route")) arreterPartage();
  }, [livraisons]);

  return (
    <div style={{ maxWidth: 560 }}>
      <h1>{complet ? "Livraisons" : "Mes livraisons"}</h1>
      {erreur && <p style={{ color: "red", fontSize: 13 }}>{erreur}</p>}
      {message && <p style={{ color: "#2E7D32", fontSize: 13 }}>{message}</p>}
      {!complet && partage && (
        <p style={{ background: "#E8F5E9", color: "#2E7D32", fontSize: 12, padding: 10, borderRadius: 8 }}>
          📍 Votre position est partagée en direct avec le client. Gardez cette page ouverte et l'écran allumé.
        </p>
      )}

      {livraisons.length === 0 && !erreur && (
        <p style={{ color: "#999" }}>{complet ? "Aucune commande de livraison." : "Aucune livraison assignée pour l'instant."}</p>
      )}

      {livraisons.map((l) => (
        <div key={l.id} style={{ background: "#fff", borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>{l.nom_produit}</strong>
            <span style={{ fontSize: 12, color: "#F5720C", fontWeight: 700 }}>{LIBELLES[l.statut]}</span>
          </div>
          <p style={{ margin: "4px 0", fontSize: 13 }}>{fmt(l.prix, l.devise)} — à encaisser à la livraison</p>
          <p style={{ margin: "4px 0", fontSize: 12, color: "#666" }}>👤 {l.client_nom} · 📞 {l.client_telephone}</p>
          <p style={{ margin: "4px 0", fontSize: 12, color: "#666" }}>📍 {l.client_adresse}</p>

          {complet && (l.statut === "en_attente" || l.statut === "acceptee") && (
            <div style={{ marginTop: 10, borderTop: "1px solid #eee", paddingTop: 10 }}>
              <p style={{ fontSize: 12, color: "#666", margin: "0 0 6px" }}>
                {l.livreur_id
                  ? <>Livreur : <strong>{personnel.find((p) => p.id === l.livreur_id)?.nom || "—"}</strong></>
                  : "Aucun livreur assigné"}
              </p>
              {personnel.length === 0 ? (
                <p style={{ fontSize: 12, color: "#999", margin: 0 }}>Aucun livreur : créez d'abord un compte dans « Personnel ».</p>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    value={choix[l.id] ?? l.livreur_id ?? ""}
                    onChange={(e) => setChoix((c) => ({ ...c, [l.id]: e.target.value }))}
                    style={{ flex: 1, minWidth: 0, padding: 8 }}
                  >
                    <option value="">— Choisir un livreur —</option>
                    {personnel.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                  </select>
                  <button
                    onClick={() => assigner(l.id)}
                    disabled={enCours === l.id || !choix[l.id] || choix[l.id] === l.livreur_id}
                    style={{ background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "0 14px", fontWeight: 700, opacity: (!choix[l.id] || choix[l.id] === l.livreur_id) ? 0.4 : 1 }}
                  >
                    {enCours === l.id ? "..." : l.livreur_id ? "Changer" : "Assigner"}
                  </button>
                </div>
              )}
            </div>
          )}

          {!complet && l.statut === "acceptee" && (
            <button onClick={() => changerStatut(l.id, "en_route")} style={{ marginTop: 8, width: "100%", background: "#F5720C", color: "#fff", border: "none", borderRadius: 6, padding: "10px 0", fontWeight: 700 }}>
              Démarrer la course
            </button>
          )}
          {!complet && l.statut === "en_route" && (
            <button onClick={() => changerStatut(l.id, "livree")} style={{ marginTop: 8, width: "100%", background: "#2E7D32", color: "#fff", border: "none", borderRadius: 6, padding: "10px 0", fontWeight: 700 }}>
              Marquer comme livrée (argent encaissé)
            </button>
          )}
          {complet && l.statut !== "livree" && l.statut !== "annulee" && (
            <button onClick={() => changerStatut(l.id, "annulee")} style={{ marginTop: 8, color: "red", background: "none", border: "none", fontSize: 12 }}>
              Annuler cette commande
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
