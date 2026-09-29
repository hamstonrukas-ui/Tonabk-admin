import { createContext, useContext } from "react";
import { Navigate } from "react-router-dom";

export const RoleContext = createContext(null);

export function useRole() {
  return useContext(RoleContext);
}

// Enveloppe une page réservée à l'admin complet : l'admin secondaire est renvoyé vers la liste des boutiques.
export function SeulementAdmin({ children }) {
  const role = useRole();
  if (role !== "admin") return <Navigate to="/toutes-boutiques" replace />;
  return children;
}
