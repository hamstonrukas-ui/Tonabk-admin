// "admin" = accès complet · "admin_secondaire" = boutiques + produits seulement · null = aucun accès
export function obtenirRole(user) {
  const roleApp = user?.app_metadata?.role;

  // L'admin secondaire n'est reconnu que via app_metadata (impossible à modifier soi-même).
  if (roleApp === "admin_secondaire") return "admin_secondaire";

  // Compatibilité avec l'existant : le rôle admin complet est encore aussi lu dans user_metadata.
  const role = roleApp || user?.user_metadata?.role;
  return role === "admin" ? "admin" : null;
}
