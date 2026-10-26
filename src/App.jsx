import { BrowserRouter, Routes, Route } from "react-router-dom";
import AdminLayout from "./admin/AdminLayout";
import AdminDashboard from "./admin/AdminDashboard";
import AdminBoutiques from "./admin/AdminBoutiques";
import AdminToutesBoutiques from "./admin/AdminToutesBoutiques";
import AdminGererProduits from "./admin/AdminGererProduits";
import AdminRequetes from "./admin/AdminRequetes";
import AdminMaisons from "./admin/AdminMaisons";
import AdminParrainages from "./admin/AdminParrainages";
import AdminPersonnel from "./admin/AdminPersonnel";
import AdminSoldes from "./admin/AdminSoldes";
import AdminPresence from "./admin/AdminPresence";
import AdminRecuperationBoutique from "./admin/AdminRecuperationBoutique";
import AdminLogin from "./admin/AdminLogin";
import DefinirMotDePasse from "./admin/DefinirMotDePasse";
import RequireAdmin from "./admin/RequireAdmin";
import { SeulementAdmin } from "./admin/RoleContext";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/connexion" element={<AdminLogin />} />
        <Route path="/definir-mot-de-passe/:token" element={<DefinirMotDePasse />} />
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
          <Route path="personnel" element={<SeulementAdmin><AdminPersonnel /></SeulementAdmin>} />
          <Route path="soldes" element={<SeulementAdmin><AdminSoldes /></SeulementAdmin>} />
          <Route path="presence" element={<AdminPresence />} />
          <Route path="recuperation" element={<SeulementAdmin><AdminRecuperationBoutique /></SeulementAdmin>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
