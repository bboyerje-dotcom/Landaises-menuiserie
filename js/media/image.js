// Compression d'image dans le navigateur.
// Le réencodage via <canvas> supprime toutes les métadonnées (EXIF, position GPS).
import { PHOTO, dimensionsCible } from '../domain/photo.js';

async function decoder(fichier) {
  try {
    // imageOrientation 'from-image' : la photo est remise à l'endroit selon l'EXIF.
    return await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  } catch {
    // Repli (anciens navigateurs) : <img>
    const url = URL.createObjectURL(fichier);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } catch {
      throw new Error('Format d’image non pris en charge par ce navigateur (ex. HEIC). Prenez la photo directement depuis l’application.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function encoder(source, largeur, hauteur) {
  const c = document.createElement('canvas');
  c.width = largeur;
  c.height = hauteur;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; // fond blanc si l'image a de la transparence
  g.fillRect(0, 0, largeur, hauteur);
  g.drawImage(source, 0, 0, largeur, hauteur);
  return new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('Compression impossible.'))), 'image/jpeg', PHOTO.qualiteJpeg));
}

export async function compresserPhoto(fichier) {
  const src = await decoder(fichier);
  const w = src.width || src.naturalWidth;
  const h = src.height || src.naturalHeight;
  const cible = dimensionsCible(w, h, PHOTO.coteMaxPx);
  const mini = dimensionsCible(w, h, PHOTO.miniaturePx);
  const [grande, petite] = await Promise.all([encoder(src, cible.largeur, cible.hauteur), encoder(src, mini.largeur, mini.hauteur)]);
  src.close?.();
  // Stockage en ArrayBuffer : plus sûr que Blob sur les anciens Safari.
  return {
    type: 'image/jpeg',
    donnees: await grande.arrayBuffer(),
    miniature: await petite.arrayBuffer(),
    largeur: cible.largeur,
    hauteur: cible.hauteur,
    taille: grande.size,
    tailleOrigine: fichier.size,
  };
}
