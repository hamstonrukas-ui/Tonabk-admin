import { Outlet, NavLink } from "react-router-dom";

export default function AdminLayout() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside style={{ width: 220, background: "#1B1B1B", color: "#fff", padding: 16 }}>
        <h2 style={{ color: "#F5720C", marginBottom: 20 }}>TonaBk Admin</h2>
        <nav style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <NavLink to="/" end>Vue d'ensemble</NavLink>
          <NavLink to="/boutiques">Boutiques à valider</NavLink>
          <NavLink to="/requetes">Requêtes</NavLink>
          <NavLink to="/maisons">Maisons</NavLink>
        </nav>
      </aside>
      <main style={{ flex: 1, padding: 24, background: "#F3F3F3" }}>
        <Outlet />
      </main>
    </div>
  );
}
