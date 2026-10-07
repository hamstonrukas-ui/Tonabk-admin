// Réduit une photo avant envoi (souvent 3-8 Mo en sortie directe d'un
// téléphone) — évite les échecs d'upload dus aux limites de taille de
// requête de l'hébergeur, et accélère l'envoi sur une connexion lente.
export function reduireImage(fichier, tailleMax = 1280, qualite = 0.8) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(fichier);
    img.onload = () => {
      const ratio = Math.min(1, tailleMax / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          resolve(blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : fichier);
        },
        "image/jpeg",
        qualite
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(fichier); };
    img.src = url;
  });
}
