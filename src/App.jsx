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
import AdminSuiviPersonnel from "./admin/AdminSuiviPersonnel";
import AdminSoldes from "./admin/AdminSoldes";
import AdminPresence from "./admin/AdminPresence";
import AdminRecuperationBoutique from "./admin/AdminRecuperationBoutique";
import AdminClassement from "./admin/AdminClassement";
import AdminLivraisons from "./admin/AdminLivraisons";
import AdminMissions from "./admin/AdminMissions";
import AdminNouveautes from "./admin/AdminNouveautes";
import AdminAnalytics from "./admin/AdminAnalytics";
import AdminMesMissions from "./admin/AdminMesMissions";
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
          <Route path="classement" element={<SeulementAdmin><AdminClassement /></SeulementAdmin>} />
          <Route path="requetes" element={<SeulementAdmin><AdminRequetes /></SeulementAdmin>} />
          <Route path="maisons" element={<SeulementAdmin><AdminMaisons /></SeulementAdmin>} />
          <Route path="parrainages" element={<SeulementAdmin><AdminParrainages /></SeulementAdmin>} />
          <Route path="personnel" element={<SeulementAdmin><AdminPersonnel /></SeulementAdmin>} />
          <Route path="personnel/:id" element={<SeulementAdmin><AdminSuiviPersonnel /></SeulementAdmin>} />
          <Route path="soldes" element={<SeulementAdmin><AdminSoldes /></SeulementAdmin>} />
          <Route path="presence" element={<AdminPresence />} />
          <Route path="missions" element={<SeulementAdmin><AdminMissions /></SeulementAdmin>} />
          <Route path="nouveautes" element={<SeulementAdmin><AdminNouveautes /></SeulementAdmin>} />
          <Route path="statistiques" element={<SeulementAdmin><AdminAnalytics /></SeulementAdmin>} />
          <Route path="mes-missions" element={<AdminMesMissions />} />
          <Route path="livraisons" element={<AdminLivraisons />} />
          <Route path="recuperation" element={<SeulementAdmin><AdminRecuperationBoutique /></SeulementAdmin>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
