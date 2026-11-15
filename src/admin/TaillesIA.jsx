// Réglages communs : tailles proposées par type d'article + commentaire ajouté à chaque description.
import { TYPES, TAILLES_DEFAUT } from "../lib/descriptionIA";

const champ = { padding: 7, borderRadius: 6, border: "1px solid #ddd", boxSizing: "border-box", width: "100%" };

export default function TaillesIA({ tailles, onTailles, commentaire, onCommentaire, desactive }) {
  return (
    <details open style={{ background: "#FFF8F2", borderRadius: 8, padding: 8 }}>
      <summary style={{ fontSize: 13, fontWeight: 600, color: "#B25000", cursor: "pointer" }}>
        Tailles et commentaire ajoutés aux descriptions
      </summary>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
        {TYPES.filter(([k]) => k !== "autre").map(([k, titre]) => (
          <label key={k} style={{ fontSize: 12 }}>
            {titre}
            <input value={tailles[k] ?? ""} disabled={desactive} style={champ} maxLength={120}
              placeholder={TAILLES_DEFAUT[k]} onChange={(e) => onTailles({ ...tailles, [k]: e.target.value })} />
          </label>
        ))}
        <label style={{ fontSize: 12 }}>
          Commentaire (ajouté à la fin de chaque description, optionnel)
          <input value={commentaire} disabled={desactive} style={champ} maxLength={200}
            placeholder="ex : Livraison possible à Bukavu. Paiement à la livraison."
            onChange={(e) => onCommentaire(e.target.value)} />
        </label>
        <span style={{ fontSize: 11, color: "#777" }}>
          L'IA reconnaît le type d'article (habit, pantalon, soulier) et applique la bonne liste ; vous pouvez la modifier ligne par ligne.
        </span>
      </div>
    </details>
  );
}
