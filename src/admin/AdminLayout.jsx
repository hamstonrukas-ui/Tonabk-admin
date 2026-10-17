import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useRole } from "./RoleContext";
import { supabase } from "../lib/supabaseClient";

export default function AdminLayout() {
  const complet = useRole() === "admin";
  const navigate = useNavigate();

  const deconnexion = async () => {
    await supabase.auth.signOut();
    navigate("/connexion");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside style={{ width: 220, background: "#1B1B1B", color: "#fff", padding: 16, display: "flex", flexDirection: "column" }}>
        <h2 style={{ color: "#F5720C", marginBottom: complet ? 20 : 4 }}>TonaBk Admin</h2>
        {!complet && <p style={{ fontSize: 11, color: "#aaa", marginBottom: 16 }}>Accès limité aux boutiques</p>}
        <nav style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
          {complet && <NavLink to="/" end>Vue d'ensemble</NavLink>}
          {complet && <NavLink to="/boutiques">Boutiques à valider</NavLink>}
          <NavLink to="/toutes-boutiques">{complet ? "Toutes les boutiques" : "Boutiques"}</NavLink>
          {complet && <NavLink to="/requetes">Requêtes</NavLink>}
          {complet && <NavLink to="/maisons">Maisons</NavLink>}
          {complet && <NavLink to="/parrainages">Parrainages</NavLink>}
          {complet && <NavLink to="/personnel">Personnel</NavLink>}
          <NavLink to="/presence">Présence</NavLink>
        </nav>
        <button
          onClick={deconnexion}
          style={{ background: "none", border: "1px solid #444", color: "#ccc", borderRadius: 6, padding: "10px 0", marginTop: 16, cursor: "pointer" }}
        >
          Déconnexion
        </button>
      </aside>
      <main style={{ flex: 1, padding: 24, background: "#F3F3F3" }}>
        <Outlet />
      </main>
    </div>
  );
}
