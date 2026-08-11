import { BrowserRouter, Routes, Route } from "react-router-dom";
import AdminLayout from "./admin/AdminLayout";
import AdminDashboard from "./admin/AdminDashboard";
import AdminBoutiques from "./admin/AdminBoutiques";
import AdminRequetes from "./admin/AdminRequetes";
import AdminMaisons from "./admin/AdminMaisons";
import AdminLogin from "./admin/AdminLogin";
import RequireAdmin from "./admin/RequireAdmin";

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
          <Route index element={<AdminDashboard />} />
          <Route path="boutiques" element={<AdminBoutiques />} />
          <Route path="requetes" element={<AdminRequetes />} />
          <Route path="maisons" element={<AdminMaisons />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
