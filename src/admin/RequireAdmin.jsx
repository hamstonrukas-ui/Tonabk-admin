import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { obtenirRole } from "../lib/role";
import { RoleContext } from "./RoleContext";

export default function RequireAdmin({ children }) {
  const [role, setRole] = useState(undefined); // undefined = en cours de vérification

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setRole(obtenirRole(data.user)));
  }, []);

  if (role === undefined) return <p style={{ textAlign: "center", fontSize: 13, color: "#999", padding: 40 }}>Chargement...</p>;
  if (!role) return <Navigate to="/connexion" replace />;
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}
