# TonaBk Admin

Dashboard admin séparé de l'app publique TonaBk — même backend, projet frontend et déploiement Vercel indépendants.

## Démarrage

```bash
npm install
cp .env.example .env   # renseigner les mêmes clés que le frontend public
npm run dev
```

## Déploiement sur Vercel

1. Nouveau projet Vercel → importe ce repo (distinct du repo frontend public)
2. Ajoute les variables d'environnement : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`
3. Déploie — tu obtiens une URL séparée, ex: `https://tonabk-admin.vercel.app`

## Accès

- `/connexion` — formulaire de connexion admin
- `/` — vue d'ensemble (protégée, redirige vers `/connexion` si non-admin)
- `/boutiques` — validation des boutiques en attente
- `/requetes` — gestion des requêtes et réponses
- `/maisons` — modération des annonces de location

Seul un compte avec `role: admin` dans les métadonnées Supabase peut accéder au dashboard — les autres sont automatiquement redirigés vers `/connexion` avec un message d'erreur.

## Nettoyage à faire côté app publique

Une fois ce projet déployé, retirer les routes `/admin/*` et le dossier `admin/` de l'app frontend publique (`tonabk-projet/frontend`), puisqu'elles sont maintenant remplacées par ce projet séparé.
