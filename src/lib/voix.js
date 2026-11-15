// Transformation de la voix : change la hauteur d'un enregistrement (voix plus aiguë ou plus grave)
// sans changer sa durée, entièrement dans le navigateur (aucune bibliothèque, aucun service payant).
//
// Principe : on relit l'enregistrement plus vite/lentement (la hauteur change, la durée aussi),
// puis on rétablit la durée d'origine avec la méthode WSOLA (étirement sans changer la hauteur).

const hann = (n) => {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
};

// Relit le signal à la vitesse p (interpolation linéaire) : p > 1 = plus aigu et plus court
function reechantillonner(x, p) {
  const n = Math.floor(x.length / p);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const pos = i * p;
    const i0 = Math.floor(pos);
    const f = pos - i0;
    out[i] = x[i0] * (1 - f) + (x[i0 + 1] ?? x[i0]) * f;
  }
  return out;
}

// Allonge (facteur > 1) ou raccourcit (facteur < 1) le signal sans changer sa hauteur (WSOLA)
function etirerWSOLA(x, facteur, sr) {
  let N = 256;
  while (N < sr * 0.04) N *= 2; // fenêtre d'environ 40 ms
  const Hs = N / 2;
  const Ha = Hs / facteur;
  const tolerance = Math.floor(N / 4);
  const longueurSortie = Math.round(x.length * facteur);
  const sortie = new Float32Array(longueurSortie + 2 * N);
  const fenetre = hann(N);
  const lire = (i) => (i >= 0 && i < x.length ? x[i] : 0);

  let debutPrecedent = 0;
  for (let k = 0; k * Hs < longueurSortie; k++) {
    let debut;
    if (k === 0) {
      debut = 0;
    } else {
      // On cherche, autour de la position prévue, l'extrait qui prolonge le mieux le précédent
      const nominal = Math.round(k * Ha);
      const cible = debutPrecedent + Hs;
      let meilleur = -Infinity;
      debut = nominal;
      for (let d = nominal - tolerance; d <= nominal + tolerance; d++) {
        if (d < 0) continue;
        let prod = 0, energie = 1e-9;
        for (let i = 0; i < Hs; i += 2) {
          const a = lire(cible + i), b = lire(d + i);
          prod += a * b;
          energie += b * b;
        }
        const score = prod / Math.sqrt(energie);
        if (score > meilleur) { meilleur = score; debut = d; }
      }
    }
    const posSortie = k * Hs;
    for (let i = 0; i < N; i++) sortie[posSortie + i] += fenetre[i] * lire(debut + i);
    debutPrecedent = debut;
  }
  return sortie.subarray(0, longueurSortie);
}

// Décale la hauteur de la voix de `demitons` (positif = plus aigu, négatif = plus grave)
export function decalerHauteur(x, sr, demitons) {
  if (!demitons) return x;
  const p = Math.pow(2, demitons / 12);
  const sortie = etirerWSOLA(reechantillonner(x, p), p, sr);
  // Volume homogène : on amène le pic à ~0,9
  let pic = 0;
  for (let i = 0; i < sortie.length; i++) pic = Math.max(pic, Math.abs(sortie[i]));
  if (pic > 0) {
    const gain = 0.9 / pic;
    for (let i = 0; i < sortie.length; i++) sortie[i] *= gain;
  }
  return sortie;
}

// Encode en WAV 16 bits mono
export function encoderWav(x, sr) {
  const buffer = new ArrayBuffer(44 + x.length * 2);
  const v = new DataView(buffer);
  const ecrire = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ecrire(0, "RIFF"); v.setUint32(4, 36 + x.length * 2, true); ecrire(8, "WAVE");
  ecrire(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  ecrire(36, "data"); v.setUint32(40, x.length * 2, true);
  for (let i = 0; i < x.length; i++) {
    const s = Math.max(-1, Math.min(1, x[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

// Enregistrement du micro (Blob) -> fichier WAV avec la voix transformée.
// L'enregistrement d'origine n'est jamais envoyé : seul ce fichier transformé peut l'être.
export async function transformerEnregistrement(blob, demitons) {
  const Contexte = window.AudioContext || window.webkitAudioContext;
  let ctx;
  try { ctx = new Contexte({ sampleRate: 22050 }); } catch { ctx = new Contexte(); }
  try {
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
    const mono = new Float32Array(audio.length);
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const canal = audio.getChannelData(c);
      for (let i = 0; i < mono.length; i++) mono[i] += canal[i] / audio.numberOfChannels;
    }
    const transforme = decalerHauteur(mono, audio.sampleRate, demitons);
    return new Blob([encoderWav(transforme, audio.sampleRate)], { type: "audio/wav" });
  } finally {
    ctx.close?.();
  }
}
