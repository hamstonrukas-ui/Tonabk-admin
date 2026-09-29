import { BrowserRouter, Routes, Route } from "react-router-dom";
import AdminLayout from "./admin/AdminLayout";
import AdminDashboard from "./admin/AdminDashboard";
import AdminBoutiques from "./admin/AdminBoutiques";
import AdminToutesBoutiques from "./admin/AdminToutesBoutiques";
import AdminGererProduits from "./admin/AdminGererProduits";
import AdminRequetes from "./admin/AdminRequetes";
import AdminMaisons from "./admin/AdminMaisons";
import AdminParrainages from "./admin/AdminParrainages";
import AdminLogin from "./admin/AdminLogin";
import RequireAdmin from "./admin/RequireAdmin";
import { SeulementAdmin } from "./admin/RoleContext";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/connexion" element={<AdminLogin />} />
        <Route
          path="/"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<SeulementAdmin><AdminDashboard /></SeulementAdmin>} />
          <Route path="boutiques" element={<SeulementAdmin><AdminBoutiques /></SeulementAdmin>} />
          <Route path="toutes-boutiques" element={<AdminToutesBoutiques />} />
          <Route path="boutiques/:id/produits" element={<AdminGererProduits />} />
          <Route path="requetes" element={<SeulementAdmin><AdminRequetes /></SeulementAdmin>} />
          <Route path="maisons" element={<SeulementAdmin><AdminMaisons /></SeulementAdmin>} />
          <Route path="parrainages" element={<SeulementAdmin><AdminParrainages /></SeulementAdmin>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
