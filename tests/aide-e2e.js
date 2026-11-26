// Outils partagés des tests de bout en bout (non exécuté comme test).

// Fabrique une vraie image JPEG dans le navigateur (dégradé + texte), renvoie un Buffer.
export async function imageJpeg(browser, largeur = 800, hauteur = 600, texte = 'TEST') {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const b64 = await p.evaluate(([w, h, t]) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const d = g.createLinearGradient(0, 0, w, h);
    d.addColorStop(0, '#2a6'); d.addColorStop(1, '#246');
    g.fillStyle = d; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.font = `${Math.round(h / 6)}px sans-serif`; g.fillText(t, w / 10, h / 2);
    return c.toDataURL('image/jpeg', 0.95).split(',')[1];
  }, [largeur, hauteur, texte]);
  await ctx.close();
  return Buffer.from(b64, 'base64');
}

// Insère un segment EXIF factice contenant un marqueur (simule une position GPS) juste après SOI.
export function avecExif(jpeg, marqueur = 'GPSPOSITIONTEST') {
  const tiff = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), Buffer.from('MM\0*\0\0\0\x08\0\0', 'binary'), Buffer.from(marqueur)]);
  const len = Buffer.alloc(2);
  len.writeUInt16BE(tiff.length + 2);
  return Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xe1]), len, tiff, jpeg.subarray(2)]);
}

export async function ajouterPhoto(p, categorie, buffer, nom, { galerie = false } = {}) {
  await p.evaluate(() => document.querySelector('[data-test=photos-msg]')?.remove()); // pas de faux « terminé »
  await p.setInputFiles(`[data-test=${galerie ? 'galerie' : 'camera'}-${categorie}]`, Array.isArray(buffer) ? buffer : { name: nom, mimeType: 'image/jpeg', buffer });
  await p.waitForFunction(() => {
    const msg = document.querySelector('[data-test=photos-msg]');
    return msg && !/Traitement/.test(msg.textContent);
  });
}

// Variante d'une image au contenu différent (octets ajoutés après la fin du JPEG, ignorés à l'affichage).
export const variante = (jpeg, suffixe) => Buffer.concat([jpeg, Buffer.from(String(suffixe))]);

export async function ajouterPhotosObligatoires(p, img) {
  await ajouterPhoto(p, 'exterieur', variante(img, 'ext'), 'ext.jpg');
  await ajouterPhoto(p, 'interieur', variante(img, 'int'), 'int.jpg');
}

export const lireBase = (p, store) => p.evaluate((s) => new Promise((ok) => {
  const r = indexedDB.open('pilotage-terrain');
  r.onsuccess = () => {
    const g = r.result.transaction(s).objectStore(s).getAll();
    g.onsuccess = () => { ok(JSON.parse(JSON.stringify(g.result, (k, v) => (v instanceof ArrayBuffer ? { octets: v.byteLength, texte: String.fromCharCode(...new Uint8Array(v)) } : v)))); r.result.close(); };
  };
}), store);

// Champs obligatoires de la fiche LDM (formulaire fenêtre / porte-fenêtre).
export async function remplirLdm(p, typologie = 'fenetre') {
  const r = (n, v) => p.check(`input[name="ldm_${n}"][value="${v}"]`);
  await r('natureCotes', 'dp');
  await r('gamme', 'g65');
  if (typologie === 'fenetre') await r('appui', 'rentrant');
  await r('poignee', 'gy_standard');
  await r('fermeture', 'pts3');
}
