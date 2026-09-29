import { Outlet, NavLink } from "react-router-dom";
import { useRole } from "./RoleContext";

export default function AdminLayout() {
  const complet = useRole() === "admin";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside style={{ width: 220, background: "#1B1B1B", color: "#fff", padding: 16 }}>
        <h2 style={{ color: "#F5720C", marginBottom: complet ? 20 : 4 }}>TonaBk Admin</h2>
        {!complet && <p style={{ fontSize: 11, color: "#aaa", marginBottom: 16 }}>Accès limité aux boutiques</p>}
        <nav style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {complet && <NavLink to="/" end>Vue d'ensemble</NavLink>}
          {complet && <NavLink to="/boutiques">Boutiques à valider</NavLink>}
          <NavLink to="/toutes-boutiques">{complet ? "Toutes les boutiques" : "Boutiques"}</NavLink>
          {complet && <NavLink to="/requetes">Requêtes</NavLink>}
          {complet && <NavLink to="/maisons">Maisons</NavLink>}
          {complet && <NavLink to="/parrainages">Parrainages</NavLink>}
        </nav>
      </aside>
      <main style={{ flex: 1, padding: 24, background: "#F3F3F3" }}>
        <Outlet />
      </main>
    </div>
  );
        }
