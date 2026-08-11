import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function RequireAdmin({ children }) {
  const [autorise, setAutorise] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const role = data.user?.app_metadata?.role || data.user?.user_metadata?.role;
      setAutorise(role === "admin");
    });
  }, []);

  if (autorise === null) return <p style={{ textAlign: "center", fontSize: 13, color: "#999", padding: 40 }}>Chargement...</p>;
  if (!autorise) return <Navigate to="/connexion" replace />;
  return children;
}
