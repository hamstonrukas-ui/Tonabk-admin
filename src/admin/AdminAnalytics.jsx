import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { API_URL } from "../lib/api";

const ORANGE = "#F5720C";
const GRIS = "#7A7A7A";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token}` };
}

const nombre = (n) => (n == null ? "—" : Number(n).toLocaleString("fr-FR"));

function formatDuree(s) {
  if (!s) return "0 s";
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const NOMS_SOURCES = { whatsapp: "WhatsApp", facebook: "Facebook", tiktok: "TikTok", instagram: "Instagram", google: "Google", direct: "Accès direct", app: "App installée", autre: "Autre site" };
const NOMS_APPAREILS = { mobile: "Téléphone", tablette: "Tablette", ordinateur: "Ordinateur" };
const NOMS_CIBLES = { boutique: "Boutiques", produit: "Produits", maison: "Maisons" };

// ---------- Petits composants ----------

function Tendance({ actuel, precedent, inverse = false }) {
  if (precedent == null || actuel == null) return null;
  if (precedent === 0) return actuel > 0 ? <span style={{ fontSize: 11, color: "#2E7D32" }}>nouveau</span> : null;
  const pct = Math.round(((actuel - precedent) / precedent) * 100);
  if (pct === 0) return <span style={{ fontSize: 11, color: GRIS }}>= période précédente</span>;
  const bon = inverse ? pct < 0 : pct > 0;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: bon ? "#2E7D32" : "#C62828" }}>
      {pct > 0 ? "▲" : "▼"} {Math.abs(pct)} % <span style={{ fontWeight: 400, color: GRIS }}>vs période précédente</span>
    </span>
  );
}

function Carte({ label, valeur, aide, children }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: ORANGE, lineHeight: 1.1 }}>{valeur}</div>
      <div style={{ fontSize: 12, color: GRIS, marginTop: 2 }}>{label}</div>
      {aide && <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{aide}</div>}
      {children && <div style={{ marginTop: 4 }}>{children}</div>}
    </div>
  );
}

function Section({ titre, sous, children }) {
  return (
    <div style={{ marginTop: 26 }}>
      <h3 style={{ margin: "0 0 2px" }}>{titre}</h3>
      {sous && <p style={{ margin: "0 0 10px", fontSize: 12, color: "#999" }}>{sous}</p>}
      {!sous && <div style={{ height: 10 }} />}
      {children}
    </div>
  );
}

const Boite = ({ children, style }) => (
  <div style={{ background: "#fff", borderRadius: 10, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,.08)", ...style }}>{children}</div>
);

function Table({ columns, rows }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#F3F3F3", textAlign: "left" }}>
            {columns.map((c) => <th key={c.key} style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: "1px solid #eee" }}>
              {columns.map((c) => <td key={c.key} style={{ padding: "10px 12px" }}>{c.render ? c.render(r[c.key], r) : (r[c.key] ?? "—")}</td>)}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={columns.length} style={{ padding: 16, color: "#999" }}>Aucune donnée</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// Barres horizontales : nom, valeur, pourcentage du total
function Barres({ items, nom = (x) => x.nom, valeur = (x) => x.nb, vide = "Pas encore de données" }) {
  const total = items.reduce((s, x) => s + valeur(x), 0);
  const max = Math.max(1, ...items.map(valeur));
  if (!items.length || total === 0) return <p style={{ color: "#999", fontSize: 13, margin: 0 }}>{vide}</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((x, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
            <span>{nom(x)}</span>
            <span style={{ color: GRIS }}>{nombre(valeur(x))} · {Math.round((valeur(x) / total) * 100)} %</span>
          </div>
          <div style={{ background: "#F3F3F3", borderRadius: 4, height: 8 }}>
            <div style={{ width: `${(valeur(x) / max) * 100}%`, background: ORANGE, borderRadius: 4, height: 8 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Plus grand « chiffre rond » au-dessus du maximum (pour l'axe vertical)
function maxRond(v) {
  if (v <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 5, 10]) if (m * p >= v) return m * p;
  return v;
}

// Courbe des visiteurs (et des pages vues), survol/toucher pour le détail d'un point
function Courbe({ points, unite }) {
  const [survol, setSurvol] = useState(null);
  const svgRef = useRef(null);
  const L = 640, Ht = 240, g = 38, d = 10, b = 28, h = 12;
  const n = points.length;
  const max = maxRond(Math.max(1, ...points.map((p) => Math.max(p.visiteurs, p.pages_vues))));
  const x = (i) => g + (n === 1 ? 0 : (i / (n - 1)) * (L - g - d));
  const y = (v) => h + (1 - v / max) * (Ht - h - b);
  const ligne = (cle) => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[cle]).toFixed(1)}`).join(" ");
  const aire = `${ligne("visiteurs")} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const pas = Math.ceil(n / 8);

  const surDeplacement = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * L;
    const i = Math.round(((px - g) / (L - g - d)) * (n - 1));
    setSurvol(Math.max(0, Math.min(n - 1, i)));
  };
  const p = survol != null ? points[survol] : null;

  return (
    <div>
      <div style={{ minHeight: 22, fontSize: 13, marginBottom: 4 }}>
        {p ? (
          <span><strong>{unite === "heure" ? `${p.label} – ${String((parseInt(p.label, 10) + 1) % 24).padStart(2, "0")}h` : p.label}</strong> : <span style={{ color: ORANGE, fontWeight: 700 }}>{p.visiteurs} visiteur{p.visiteurs > 1 ? "s" : ""}</span> · {p.pages_vues} pages vues · {p.clics} clic{p.clics > 1 ? "s" : ""} WhatsApp</span>
        ) : (
          <span style={{ color: "#999" }}>Passez le doigt ou la souris sur la courbe pour voir le détail</span>
        )}
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${L} ${Ht}`} style={{ width: "100%", height: "auto", touchAction: "pan-y" }}
        onPointerMove={surDeplacement} onPointerDown={surDeplacement} onPointerLeave={() => setSurvol(null)}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={g} x2={L - d} y1={y(max * t)} y2={y(max * t)} stroke="#eee" />
            <text x={g - 6} y={y(max * t) + 4} fontSize="11" textAnchor="end" fill="#999">{Math.round(max * t)}</text>
          </g>
        ))}
        {points.map((pt, i) => i % pas === 0 && (
          <text key={i} x={x(i)} y={Ht - 8} fontSize="11" textAnchor="middle" fill="#999">{pt.label}</text>
        ))}
        <path d={aire} fill={ORANGE} opacity="0.12" />
        <path d={ligne("pages_vues")} fill="none" stroke="#9E9E9E" strokeWidth="1.5" strokeDasharray="4 3" />
        <path d={ligne("visiteurs")} fill="none" stroke={ORANGE} strokeWidth="2.5" strokeLinejoin="round" />
        {survol != null && (
          <g>
            <line x1={x(survol)} x2={x(survol)} y1={h} y2={y(0)} stroke="#ccc" />
            <circle cx={x(survol)} cy={y(p.visiteurs)} r="4.5" fill={ORANGE} stroke="#fff" strokeWidth="2" />
            <circle cx={x(survol)} cy={y(p.pages_vues)} r="3.5" fill="#9E9E9E" stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>
      <div style={{ display: "flex", gap: 16, fontSize: 12, color: GRIS, marginTop: 4 }}>
        <span><span style={{ color: ORANGE, fontWeight: 800 }}>━</span> Visiteurs</span>
        <span><span style={{ color: "#9E9E9E", fontWeight: 800 }}>╌</span> Pages vues</span>
      </div>
    </div>
  );
}

// Activité par heure de la journée (heure de Bukavu)
function Heures({ heures }) {
  const max = Math.max(1, ...heures);
  const meilleure = heures.indexOf(Math.max(...heures));
  if (heures.every((v) => v === 0)) return <p style={{ color: "#999", fontSize: 13, margin: 0 }}>Pas encore de données</p>;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 110 }}>
        {heures.map((v, hr) => (
          <div key={hr} title={`${hr}h : ${v} pages vues`} style={{ flex: 1, background: hr === meilleure ? ORANGE : "#F5B07A", height: `${Math.max(2, (v / max) * 100)}%`, borderRadius: "2px 2px 0 0" }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 2, fontSize: 10, color: "#999", marginTop: 2 }}>
        {heures.map((_, hr) => <div key={hr} style={{ flex: 1, textAlign: "center" }}>{hr % 3 === 0 ? `${hr}h` : ""}</div>)}
      </div>
      <p style={{ fontSize: 12, color: GRIS, margin: "8px 0 0" }}>Heure la plus active : <strong>{meilleure}h – {(meilleure + 1) % 24}h</strong></p>
    </div>
  );
}

// ---------- Page ----------

const PERIODES = [["24h", "24 heures"], ["7j", "7 jours"], ["30j", "30 jours"]];

export default function AdminAnalytics() {
  const [periode, setPeriode] = useState("24h");
  const [t, setT] = useState(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  // Détails complémentaires (données déjà existantes)
  const [boutiques, setBoutiques] = useState([]);
  const [actifs, setActifs] = useState([]);
  const [typesVisiteurs, setTypesVisiteurs] = useState([]);
  const [retention, setRetention] = useState([]);
  const [frequenceConnexion, setFrequenceConnexion] = useState([]);

  const charger = useCallback(async (silencieux = false) => {
    if (!silencieux) setChargement(true);
    try {
      const res = await fetch(`${API_URL}/api/admin-analytics/tableau?periode=${periode}`, { headers: await authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = res.status === 404
          ? "Le tableau de bord n'est pas encore disponible sur le serveur : redéployez le backend."
          : /column|colonne/i.test(data.error || "")
            ? "La base n'est pas prête : exécutez analytics-tableau.sql dans Supabase."
            : data.error || `Erreur ${res.status}`;
        throw new Error(msg);
      }
      setT(data);
      setErreur("");
    } catch (err) {
      setErreur(err.message || "Impossible de contacter le serveur");
    }
    setChargement(false);
  }, [periode]);

  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") charger(true); }, 60000);
    return () => clearInterval(id);
  }, [charger]);

  useEffect(() => {
    (async () => {
      const headers = await authHeaders();
      const appeler = (chemin, setter) =>
        fetch(`${API_URL}/api/admin-analytics/${chemin}`, { headers }).then(async (r) => { if (r.ok) setter(await r.json()); }).catch(() => {});
      await Promise.all([
        appeler("boutiques", setBoutiques),
        appeler("utilisateurs-actifs", setActifs),
        appeler("types-visiteurs?jours=7", setTypesVisiteurs),
        appeler("retention", setRetention),
        appeler("frequence-connexion", setFrequenceConnexion),
      ]);
    })();
  }, []);

  const dau = actifs.find((a) => a.periode === "24h")?.visiteurs_uniques ?? "—";
  const wau = actifs.find((a) => a.periode === "7j")?.visiteurs_uniques ?? "—";
  const mau = actifs.find((a) => a.periode === "30j")?.visiteurs_uniques ?? "—";
  const nouveaux = typesVisiteurs.find((x) => x.type_visiteur === "nouveau")?.nb ?? 0;
  const recurrents = typesVisiteurs.find((x) => x.type_visiteur === "recurrent")?.nb ?? 0;
  const dernierTauxRetention = retention[0]?.taux_retention;

  const k = t?.kpi, p = t?.precedent;
  const bouton = (actif) => ({
    padding: "8px 14px", borderRadius: 999, border: `1px solid ${ORANGE}`, fontWeight: 600, fontSize: 13, cursor: "pointer",
    background: actif ? ORANGE : "#fff", color: actif ? "#fff" : ORANGE,
  });
  const grille = (min) => ({ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ margin: 0 }}>Statistiques</h1>
        {k && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", borderRadius: 999, padding: "6px 12px", fontSize: 13, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: k.en_ligne > 0 ? "#2E7D32" : "#bbb" }} />
            <strong>{k.en_ligne}</strong> en ligne maintenant
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, margin: "14px 0", alignItems: "center", flexWrap: "wrap" }}>
        {PERIODES.map(([cle, texte]) => <button key={cle} onClick={() => setPeriode(cle)} style={bouton(periode === cle)}>{texte}</button>)}
        <button onClick={() => charger()} style={{ ...bouton(false), border: "1px solid #ddd", color: "#444" }}>↻ Actualiser</button>
        {t && <span style={{ fontSize: 11, color: "#999" }}>Mis à jour à {new Date(t.genere_le).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>}
      </div>

      {erreur && <p style={{ color: "red", fontSize: 13 }}>{erreur}</p>}
      {chargement && !t && !erreur && <p style={{ color: "#999" }}>Chargement des statistiques…</p>}

      {t && (
        <>
          {t.tronque && <p style={{ fontSize: 12, color: "#C62828" }}>Beaucoup de données : seules les plus récentes sont prises en compte. Choisissez une période plus courte.</p>}

          <div style={grille(170)}>
            <Carte label="Visiteurs uniques" valeur={nombre(k.visiteurs)}><Tendance actuel={k.visiteurs} precedent={p.visiteurs} /></Carte>
            <Carte label="Visites" valeur={nombre(k.visites)}><Tendance actuel={k.visites} precedent={p.visites} /></Carte>
            <Carte label="Pages vues" valeur={nombre(k.pages_vues)} aide={k.pages_par_visite ? `${k.pages_par_visite.toFixed(1)} pages par visite` : null}><Tendance actuel={k.pages_vues} precedent={p.pages_vues} /></Carte>
            <Carte label="Temps moyen par visite" valeur={formatDuree(k.duree_moyenne)} aide={k.duree_mediane ? `Médiane : ${formatDuree(k.duree_mediane)}` : null}><Tendance actuel={k.duree_moyenne} precedent={p.duree_moyenne} /></Carte>
            <Carte label="Clics WhatsApp" valeur={nombre(k.clics_whatsapp)} aide={k.taux_conversion != null ? `${k.taux_conversion} % des visiteurs contactent` : null}><Tendance actuel={k.clics_whatsapp} precedent={p.clics_whatsapp} /></Carte>
            <Carte label="Taux de rebond" valeur={k.taux_rebond != null ? `${k.taux_rebond} %` : "—"} aide="Visites avec une seule page"><Tendance actuel={k.taux_rebond} precedent={p.taux_rebond} inverse /></Carte>
          </div>

          <Section titre={periode === "24h" ? "Visiteurs heure par heure (dernières 24 h)" : `Visiteurs jour par jour (${periode === "7j" ? "7" : "30"} derniers jours)`} sous="Heure de Bukavu. Un visiteur est compté une fois par créneau.">
            <Boite><Courbe points={t.courbe} unite={periode === "24h" ? "heure" : "jour"} /></Boite>
          </Section>

          <div style={{ ...grille(300), marginTop: 26 }}>
            <div>
              <h3 style={{ margin: "0 0 10px" }}>Temps passé par visite</h3>
              <Boite><Barres items={t.repartition_duree} vide="Pas encore de données de durée (elles s'accumulent à partir de maintenant)" /></Boite>
            </div>
            <div>
              <h3 style={{ margin: "0 0 10px" }}>Heures les plus actives</h3>
              <Boite><Heures heures={t.heures} /></Boite>
            </div>
            <div>
              <h3 style={{ margin: "0 0 10px" }}>D'où viennent les visites</h3>
              <Boite><Barres items={t.sources} nom={(x) => NOMS_SOURCES[x.nom] || x.nom} /></Boite>
            </div>
            <div>
              <h3 style={{ margin: "0 0 10px" }}>Appareils</h3>
              <Boite><Barres items={t.appareils} nom={(x) => NOMS_APPAREILS[x.nom] || x.nom} /></Boite>
            </div>
            <div>
              <h3 style={{ margin: "0 0 10px" }}>Parties du site les plus visitées</h3>
              <Boite><Barres items={t.sections} valeur={(x) => x.vues} nom={(x) => `${x.nom} (${x.visiteurs} visiteur${x.visiteurs > 1 ? "s" : ""})`} /></Boite>
            </div>
            <div>
              <h3 style={{ margin: "0 0 10px" }}>Clics WhatsApp par type</h3>
              <Boite><Barres items={t.clics_par_type} nom={(x) => NOMS_CIBLES[x.nom] || x.nom} /></Boite>
            </div>
          </div>

          <Section titre="Boutiques les plus vues">
            <Table columns={[
              { key: "nom", label: "Boutique" },
              { key: "vues", label: "Pages vues" },
              { key: "visiteurs", label: "Visiteurs" },
            ]} rows={t.boutiques} />
          </Section>

          <Section titre="Produits les plus vus">
            <Table columns={[
              { key: "nom", label: "Produit" },
              { key: "vues", label: "Pages vues" },
              { key: "visiteurs", label: "Visiteurs" },
            ]} rows={t.produits} />
          </Section>

          <Section titre="Pages les plus consultées">
            <Table columns={[
              { key: "chemin", label: "Page" },
              { key: "vues", label: "Pages vues" },
            ]} rows={t.top_pages} />
          </Section>
        </>
      )}

      <Section titre="Visiteurs actifs" sous="Visiteurs uniques sur 24 h, 7 jours et 30 jours">
        <div style={grille(170)}>
          <Carte label="Actifs (24h)" valeur={dau} />
          <Carte label="Actifs (7 jours)" valeur={wau} />
          <Carte label="Actifs (30 jours)" valeur={mau} />
        </div>
      </Section>

      <Section titre="Nouveaux et récurrents (7 derniers jours)">
        <div style={grille(170)}>
          <Carte label="Nouveaux visiteurs" valeur={nouveaux} />
          <Carte label="Visiteurs récurrents" valeur={recurrents} />
          <Carte label="Rétention J+7 (dernière cohorte)" valeur={dernierTauxRetention != null ? `${dernierTauxRetention}%` : "—"} />
        </div>
      </Section>

      <Section titre="Performance par boutique (clics WhatsApp, visites, connexions du propriétaire)">
        <Table
          columns={[
            { key: "nom", label: "Boutique" },
            { key: "clics_whatsapp", label: "Clics WhatsApp" },
            { key: "visites", label: "Visites" },
            { key: "visiteurs_uniques", label: "Visiteurs uniques" },
            { key: "nb_connexions_owner", label: "Connexions propriétaire" },
            { key: "derniere_visite", label: "Dernière visite", render: formatDate },
            { key: "derniere_connexion", label: "Dernière connexion", render: formatDate },
          ]}
          rows={boutiques}
        />
      </Section>

      <Section titre="Fréquence de connexion par boutique">
        <Table
          columns={[
            { key: "nom", label: "Boutique" },
            { key: "nb_connexions", label: "Nombre de connexions" },
            { key: "premiere_connexion", label: "Première connexion", render: formatDate },
            { key: "derniere_connexion", label: "Dernière connexion", render: formatDate },
          ]}
          rows={frequenceConnexion}
        />
      </Section>

      <Section titre="Rétention par cohorte (visiteurs revenus dans les 7 jours)">
        <Table
          columns={[
            { key: "cohorte", label: "Jour de première visite" },
            { key: "nb_nouveaux", label: "Nouveaux visiteurs" },
            { key: "nb_revenus", label: "Revenus sous 7j" },
            { key: "taux_retention", label: "Taux", render: (v) => (v != null ? `${v}%` : "—") },
          ]}
          rows={retention}
        />
      </Section>
    </div>
  );
}
