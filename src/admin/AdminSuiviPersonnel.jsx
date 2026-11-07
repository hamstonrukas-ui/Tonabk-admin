import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` };
}

const heure = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const jourLong = (d) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const moisLong = (cle) => new Date(cle + "-01T12:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

function duree(debut, fin) {
  if (!fin) return null;
  const min = Math.round((new Date(fin) - new Date(debut)) / 60000);
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

const lienCarte = (lat, lng) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;

export default function AdminSuiviPersonnel() {
  const { id } = useParams();
  const [infos, setInfos] = useState(null);
  const [erreur, setErreur] = useState("");
  const [ouvert, setOuvert] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/suivi-personnel/${id}`, { headers: await authHeaders() });
        if (res.ok) setInfos(await res.json());
        else setErreur((await res.json().catch(() => ({}))).error || `Erreur ${res.status}`);
      } catch {
        setErreur("Impossible de contacter le serveur");
      }
    })();
  }, [id]);

  if (erreur) return <p style={{ color: "red" }}>{erreur}</p>;
  if (!infos) return <p>Chargement...</p>;

  const { jours } = infos;
  const moisCourant = new Date().toISOString().slice(0, 7);
  const joursMois = jours.filter((j) => j.date.startsWith(moisCourant)).length;
  const nonCloturees = jours.filter((j) => !j.heure_fin).length;

  // Regroupement par mois
  const parMois = {};
  for (const j of jours) (parMois[j.date.slice(0, 7)] ||= []).push(j);

  return (
    <div style={{ maxWidth: 620 }}>
      <Link to="/personnel" style={{ fontSize: 13, color: "#F5720C" }}>← Retour au personnel</Link>
      <h1 style={{ marginBottom: 2 }}>{infos.nom}</h1>
      <p style={{ marginTop: 0, color: "#7A7A7A", fontSize: 13 }}>{infos.telephone}</p>

      <div style={{ display: "flex", gap: 10, margin: "16px 0 24px" }}>
        {[
          { v: joursMois, l: "jours ce mois" },
          { v: jours.length, l: "jours au total" },
          { v: nonCloturees, l: "non clôturés", alerte: nonCloturees > 0 },
        ].map((c) => (
          <div key={c.l} style={{ flex: 1, background: "#fff", borderRadius: 10, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: c.alerte ? "#D32F2F" : "#F5720C" }}>{c.v}</div>
            <div style={{ fontSize: 11, color: "#7A7A7A" }}>{c.l}</div>
          </div>
        ))}
      </div>

      {jours.length === 0 && <p style={{ color: "#999" }}>Aucun jour de travail enregistré pour l'instant.</p>}

      {Object.keys(parMois).map((mois) => (
        <div key={mois} style={{ marginBottom: 22 }}>
          <h3 style={{ textTransform: "capitalize", margin: "0 0 8px" }}>
            {moisLong(mois)} <span style={{ fontWeight: 400, color: "#999", fontSize: 13 }}>— {parMois[mois].length} jour{parMois[mois].length > 1 ? "s" : ""}</span>
          </h3>

          <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden" }}>
            {parMois[mois].map((j) => {
              const ouv = ouvert === j.id;
              return (
                <div key={j.id} style={{ borderBottom: "1px solid #eee" }}>
                  <button
                    onClick={() => setOuvert(ouv ? null : j.id)}
                    style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: 12, cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ textTransform: "capitalize", fontSize: 14 }}>{jourLong(j.date)}</strong>
                      <span style={{ fontSize: 11, fontWeight: 700, color: j.heure_fin ? "#2E7D32" : "#D32F2F" }}>
                        {j.heure_fin ? "✓ Clôturée" : "Non clôturée"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 3 }}>
                      {heure(j.heure_debut)} → {j.heure_fin ? heure(j.heure_fin) : "—"}
                      {j.heure_fin && <> · <strong>{duree(j.heure_debut, j.heure_fin)}</strong></>}
                    </div>
                    {!ouv && j.activites && (
                      <div style={{ fontSize: 12, color: "#999", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {j.activites}
                      </div>
                    )}
                  </button>

                  {ouv && (
                    <div style={{ background: "#FAFAFA", padding: "4px 14px 14px", fontSize: 13 }}>
                      <p style={{ margin: "8px 0 2px", fontWeight: 700, fontSize: 12, color: "#F5720C" }}>ACTIVITÉS RÉALISÉES</p>
                      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{j.activites || <em style={{ color: "#999" }}>Aucun rapport (journée non clôturée)</em>}</p>

                      <p style={{ margin: "12px 0 2px", fontWeight: 700, fontSize: 12, color: "#F5720C" }}>DIFFICULTÉS RENCONTRÉES</p>
                      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{j.difficultes || <em style={{ color: "#999" }}>Aucune signalée</em>}</p>

                      <p style={{ margin: "12px 0 2px", fontWeight: 700, fontSize: 12, color: "#F5720C" }}>LIEU</p>
                      <p style={{ margin: 0 }}>
                        🟢 Début : {j.adresse_debut || "adresse non trouvée"}{" "}
                        <a href={lienCarte(j.lat_debut, j.lng_debut)} target="_blank" rel="noopener noreferrer" style={{ color: "#F5720C" }}>carte</a>
                      </p>
                      {j.heure_fin && (
                        <p style={{ margin: "4px 0 0" }}>
                          🔴 Fin : {j.lat_fin != null ? (j.adresse_fin || "adresse non trouvée") : "position non partagée"}{" "}
                          {j.lat_fin != null && (
                            <a href={lienCarte(j.lat_fin, j.lng_fin)} target="_blank" rel="noopener noreferrer" style={{ color: "#F5720C" }}>carte</a>
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
