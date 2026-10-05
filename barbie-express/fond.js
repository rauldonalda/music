// Fond de la page : la photo ondule très légèrement en permanence. Le mouvement de la souris accentue les
// vagues (plus le geste est ample, plus elles sont grandes) et fait tourner un peu l'image autour du centre
// du pavillon, comme un disque qu'on entraîne de la main. Pas de réaction à la musique.

const reglages = {
  image: { src: "fond.jpg", largeur: 1920, hauteur: 1280 },
  carte: "../bulldozer/normal.jpg",   // la carte de déformation, la même que pour Bulldozer
  taille: 700,                        // largeur d'une vague, en pixels
  repos: 22,                          // ondulation permanente, en pixels
  derive: 0.8,                        // vitesse à laquelle les vagues glissent au repos, en pixels par image
  force: 54,                          // ondulation maximale, pour un grand geste rapide
  ampleur: 280,                       // élan de souris (en pixels) qui donne l'ondulation maximale
  suivi: 0.3,                         // part du geste de la souris transmise aux vagues
  retour: 0.035,                      // vitesse du retour au calme (plus petit = plus lent)
  pivot: { x: 0.44, y: 0.97 },        // centre du pavillon dans la photo (part de la largeur, de la hauteur)
  angleMax: 3,                        // rotation maximale, en degrés, de part et d'autre
  entrainement: 0.1                   // part du tour de souris transmise au disque
};

let ww = window.innerWidth, wh = window.innerHeight;
const rendu = new PIXI.autoDetectRenderer({ width: ww, height: wh, transparent: true,
                                           resolution: Math.min(window.devicePixelRatio || 1, 1.5), autoResize: true });
const scene = new PIXI.Container();
const imageFixe = document.getElementById("fond");
let photo = null, carte = null, filtre = null;
let pivotX = 0, pivotY = 0, agrandissement = 1;   // position du centre du pavillon à l'écran

// La photo couvre la fenêtre, comme l'image fixe placée dessous. Elle est un peu agrandie, juste assez
// pour qu'aucun coin de la fenêtre ne se découvre quand elle tourne de l'angle maximal.
function couvrir() {
  const img = reglages.image, k = Math.max(ww / img.largeur, wh / img.hauteur);
  const a = reglages.angleMax * Math.PI / 180;
  let z = 1, L, H;
  for (; z < 1.6; z += 0.005) {
    L = img.largeur * k * z; H = img.hauteur * k * z;
    pivotX = ww / 2 + (reglages.pivot.x - 0.5) * L; pivotY = wh / 2 + (reglages.pivot.y - 0.5) * H;
    const dedans = [-a, a].every(angle => [[0, 0], [ww, 0], [0, wh], [ww, wh]].every(([x, y]) => {
      // le coin de la fenêtre, ramené dans le repère de la photo tournée
      const dx = x - pivotX, dy = y - pivotY;
      const u = pivotX + dx * Math.cos(angle) + dy * Math.sin(angle), v = pivotY - dx * Math.sin(angle) + dy * Math.cos(angle);
      return Math.abs(u - ww / 2) <= L / 2 && Math.abs(v - wh / 2) <= H / 2;
    }));
    if (dedans) break;
  }
  agrandissement = z;
  if (imageFixe) imageFixe.style.transform = "scale(" + z.toFixed(3) + ")";   // l'image fixe prend le même cadrage
  if (photo) { photo.x = pivotX; photo.y = pivotY; photo.width = L; photo.height = H; }
}

let elan = 0, energie = 0, angle = 0, angleVise = 0, dernier = 0, enCours = false;
let fige = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const lisse = (f, dt) => 1 - Math.pow(1 - f, dt);   // même inertie quelle que soit la cadence de l'écran

function image(maintenant) {
  if (fige) { enCours = false; return; }   // image figée : on ne redessine plus rien
  const dt = Math.min(3, (maintenant - dernier) / 16.7 || 1); dernier = maintenant;

  // les vagues : un fond permanent, que l'élan de la souris vient grossir
  const cible = Math.min(1, Math.pow(elan / reglages.ampleur, 0.8));
  energie += (cible - energie) * lisse(cible > energie ? 0.12 : reglages.retour, dt);
  elan *= Math.pow(0.86, dt);
  carte.x += (reglages.derive + 0.6 * energie) * dt; carte.y -= (reglages.derive * 0.64 + 0.4 * energie) * dt;
  filtre.scale.x = filtre.scale.y = reglages.repos + (reglages.force - reglages.repos) * energie;

  // le disque : il rejoint avec inertie l'angle où la souris l'a poussé, puis revient lentement au repos
  angle += (angleVise - angle) * lisse(0.07, dt);
  angleVise *= Math.pow(0.994, dt);
  photo.rotation = angle;

  rendu.render(scene);
  requestAnimationFrame(image);
}
function lancer() {
  if (enCours || fige || !filtre) return;
  enCours = true; dernier = performance.now(); requestAnimationFrame(image);
}

const chargeur = new PIXI.loaders.Loader();
chargeur.add("photo", reglages.image.src).add("carte", reglages.carte);
chargeur.load((_, ressources) => {
  carte = new PIXI.Sprite(ressources.carte.texture);
  carte.width = carte.height = reglages.taille;
  carte.texture.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
  photo = new PIXI.Sprite(ressources.photo.texture);
  photo.anchor.set(reglages.pivot.x, reglages.pivot.y);
  couvrir();
  filtre = new PIXI.filters.DisplacementFilter(carte, fige ? 0 : reglages.repos);
  photo.filters = [filtre];
  scene.addChild(photo, carte);
  rendu.render(scene);
  document.getElementById("onde").appendChild(rendu.view);
  lancer();
});
couvrir();

let sourisX = null, sourisY = null;
window.addEventListener("pointermove", e => {
  if (sourisX !== null && !fige && carte) {
    const dx = e.clientX - sourisX, dy = e.clientY - sourisY;
    elan += Math.hypot(dx, dy);
    carte.x -= dx * reglages.suivi; carte.y -= dy * reglages.suivi;
    // de combien la souris a tourné autour du centre du pavillon (dans le sens des aiguilles : positif)
    const rx = sourisX - pivotX, ry = sourisY - pivotY, r2 = Math.max(150 * 150, rx * rx + ry * ry);
    const max = reglages.angleMax * Math.PI / 180;
    angleVise = Math.max(-max, Math.min(max, angleVise + reglages.entrainement * (rx * dy - ry * dx) / r2));
  }
  sourisX = e.clientX; sourisY = e.clientY;
});

window.addEventListener("resize", () => {
  ww = window.innerWidth; wh = window.innerHeight;
  rendu.resize(ww, wh);
  couvrir();
  if (photo) rendu.render(scene);
});

const boutonFiger = document.getElementById("b-figer");
const majFiger = () => { boutonFiger.textContent = fige ? "Relancer le mouvement" : "Figer l'image"; };
boutonFiger.addEventListener("click", () => { fige = !fige; majFiger(); lancer(); });
majFiger();
