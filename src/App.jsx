import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import BarreNavigation from "./components/BarreNavigation";
import InstallButton from "./components/InstallButton";
import ActualiserBouton from "./components/ActualiserBouton";
import AidePage from "./components/AidePage";
import { CartProvider } from "./context/CartContext";

// Accueil
import Accueil from "./pages/Accueil";
import LienAgent from "./pages/LienAgent";
import ListeExpeditions from "./pages/Expeditions/ListeExpeditions";
import DetailExpedition from "./pages/Expeditions/DetailExpedition";
import DepotColis from "./pages/Expeditions/DepotColis";
import APropos from "./pages/APropos";
import CommentCaMarche from "./pages/CommentCaMarche";
import Confidentialite from "./pages/Confidentialite";

// Boutique
import CategoriesBoutique from "./pages/Boutique/CategoriesBoutique";
import ListeBoutiquesCategorie from "./pages/Boutique/ListeBoutiquesCategorie";
import BoutiqueLayout from "./pages/Boutique/BoutiqueLayout";
import Catalogue from "./pages/Boutique/Catalogue";
import Panier from "./pages/Boutique/Panier";
import Commande from "./pages/Boutique/Commande";
import Avis from "./pages/Boutique/Avis";
import Parrainage from "./pages/Boutique/Parrainage";
import Nouveautes from "./pages/Boutique/Nouveautes";
import CreerBoutique from "./pages/Boutique/CreerBoutique";
import GererBoutique from "./pages/Boutique/GererBoutique";
import Inventaire from "./pages/Boutique/Inventaire";
import DetailProduit from "./pages/Boutique/DetailProduit";
import ListeSoldes from "./pages/Soldes/ListeSoldes";
import MesCommandes from "./pages/Livraison/MesCommandes";
import DetailSolde from "./pages/Soldes/DetailSolde";
import ListeNouveautes from "./pages/Nouveautes/ListeNouveautes";
import PublierNouveaute from "./pages/Nouveautes/PublierNouveaute";
import ListeKisakoshi from "./pages/Kisakoshi/ListeKisakoshi";
import PublierKisakoshi from "./pages/Kisakoshi/PublierKisakoshi";
import RechercheBoutique from "./pages/Boutique/Recherche";
import Populaires from "./pages/Boutique/Populaires";

// Location
import LocationAccueil from "./pages/Location/Accueil";
import RechercheLocation from "./pages/Location/Recherche";
import Fiche from "./pages/Location/Fiche";
import FavorisLocation from "./pages/Location/Favoris";
import Publier from "./pages/Location/Publier";
import GererMesMaisons from "./pages/Location/GererMesMaisons";

// Requête
import ListeRequetes from "./pages/Requete/ListeRequetes";
import PublierRequete from "./pages/Requete/PublierRequete";
import DetailRequete from "./pages/Requete/DetailRequete";

// Auth
import Connexion from "./pages/Auth/Connexion";
import AccederBoutique from "./pages/Auth/AccederBoutique";
import Inscription from "./pages/Auth/Inscription";
import MotDePasseOublie from "./pages/Auth/MotDePasseOublie";
import ReinitialiserMotDePasse from "./pages/Auth/ReinitialiserMotDePasse";
import { enregistrerVisiteSession, enregistrerPageVue, demarrerSuiviDuree } from "./lib/analytics";

function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#F3F3F3] flex flex-col max-w-6xl mx-auto">
      <div className="flex-1 pb-20">{children}</div>
      <ActualiserBouton />
      <AidePage />
      <BarreNavigation />
    </div>
  );
}

// Compte chaque page consultée (statistiques de l'admin) — invisible pour le visiteur
function SuiviPages() {
  const { pathname } = useLocation();
  useEffect(() => { enregistrerPageVue(pathname); }, [pathname]);
  return null;
}

export default function App() {
  useEffect(() => {
    enregistrerVisiteSession();
    demarrerSuiviDuree();
  }, []);

  useEffect(() => {
    const declencher = () => window.dispatchEvent(new Event("tonabk:revalidate"));

    const auDemarrage = setTimeout(declencher, 3000);
    window.addEventListener("online", declencher);

    return () => {
      clearTimeout(auDemarrage);
      window.removeEventListener("online", declencher);
    };
  }, []);

  return (
    <BrowserRouter>
      <SuiviPages />
      <CartProvider>
        <InstallButton />
        <Routes>
          {/* Accueil */}
          <Route path="/" element={<AppLayout><Accueil /></AppLayout>} />
          <Route path="/a-propos" element={<AppLayout><APropos /></AppLayout>} />
          <Route path="/expeditions" element={<AppLayout><ListeExpeditions /></AppLayout>} />
          <Route path="/expeditions/deposer" element={<AppLayout><DepotColis /></AppLayout>} />
          <Route path="/expeditions/:id" element={<AppLayout><DetailExpedition /></AppLayout>} />
          <Route path="/comment-ca-marche" element={<AppLayout><CommentCaMarche /></AppLayout>} />
          <Route path="/confidentialite" element={<AppLayout><Confidentialite /></AppLayout>} />

          {/* Boutique — découverte par catégorie */}
          <Route path="/boutique" element={<AppLayout><CategoriesBoutique /></AppLayout>} />
          <Route path="/boutique/categorie/:categorieId" element={<AppLayout><ListeBoutiquesCategorie /></AppLayout>} />
          <Route path="/boutique/creer" element={<AppLayout><CreerBoutique /></AppLayout>} />
          <Route path="/boutique/gerer" element={<AppLayout><GererBoutique /></AppLayout>} />
          <Route path="/boutique/inventaire" element={<AppLayout><Inventaire /></AppLayout>} />
          <Route path="/boutique/recherche" element={<AppLayout><RechercheBoutique /></AppLayout>} />
          <Route path="/boutique/populaires" element={<AppLayout><Populaires /></AppLayout>} />
          <Route path="/boutique/produit/:id" element={<AppLayout><DetailProduit /></AppLayout>} />
          <Route path="/soldes" element={<AppLayout><ListeSoldes /></AppLayout>} />
          <Route path="/mes-commandes" element={<AppLayout><MesCommandes /></AppLayout>} />
          <Route path="/soldes/:id" element={<AppLayout><DetailSolde /></AppLayout>} />
          <Route path="/nouveautes" element={<AppLayout><ListeNouveautes /></AppLayout>} />
          <Route path="/nouveautes/publier" element={<AppLayout><PublierNouveaute /></AppLayout>} />
          <Route path="/kisakoshi" element={<AppLayout><ListeKisakoshi /></AppLayout>} />
          <Route path="/kisakoshi/publier" element={<AppLayout><PublierKisakoshi /></AppLayout>} />

          {/* Boutique — mini-site d'une boutique précise */}
          <Route path="/boutique/:id" element={<AppLayout><BoutiqueLayout /></AppLayout>}>
            <Route index element={<Catalogue />} />
            <Route path="panier" element={<Panier />} />
            <Route path="commande" element={<Commande />} />
            <Route path="avis" element={<Avis />} />
            <Route path="parrainage" element={<Parrainage />} />
            <Route path="nouveautes" element={<Nouveautes />} />
          </Route>

          {/* Location */}
          <Route path="/location" element={<AppLayout><LocationAccueil /></AppLayout>} />
          <Route path="/location/recherche" element={<AppLayout><RechercheLocation /></AppLayout>} />
          <Route path="/location/maison/:id" element={<AppLayout><Fiche /></AppLayout>} />
          <Route path="/location/favoris" element={<AppLayout><FavorisLocation /></AppLayout>} />
          <Route path="/location/publier" element={<AppLayout><Publier /></AppLayout>} />
          <Route path="/location/mes-maisons" element={<AppLayout><GererMesMaisons /></AppLayout>} />

          {/* Requête */}
          <Route path="/requete" element={<AppLayout><ListeRequetes /></AppLayout>} />
          <Route path="/requete/publier" element={<AppLayout><PublierRequete /></AppLayout>} />
          <Route path="/requete/:id" element={<AppLayout><DetailRequete /></AppLayout>} />

          {/* Auth */}
          <Route path="/connexion" element={<Connexion />} />
          <Route path="/boutique/acceder" element={<AccederBoutique />} />
          <Route path="/inscription" element={<Inscription />} />
          <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
          <Route path="/reinitialiser-mot-de-passe" element={<ReinitialiserMotDePasse />} />
          {/* Adresse personnelle d'un agent de sensibilisation : tonabk.com/<code> (toujours en dernier) */}
          <Route path="/:code" element={<LienAgent />} />
        </Routes>
      </CartProvider>
    </BrowserRouter>
  );
      }
