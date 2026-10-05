// La gravure ondule doucement et sans à-coups, comme une feuille qui respire.
// Le mouvement s'amplifie un peu, progressivement, pendant qu'un morceau joue.

const reglages = {
  image: { src: "gavarni.jpg", largeur: 1432, hauteur: 1852 },
  carte: "../bulldozer/normal.jpg",   // la carte de déformation, la même que pour Bulldozer
  taille: 520,                        // largeur d'une ondulation, en pixels
  repos: 9,                           // ampleur de l'ondulation au repos, en pixels
  musique: 17,                        // ampleur pendant qu'un morceau joue
  derive: 0.35                        // vitesse à laquelle les ondulations glissent, en pixels par image
};

const figure = document.getElementById("gravure"), imageFixe = figure.querySelector("img"),
      boutonFiger = document.getElementById("b-figer");
const rendu = new PIXI.autoDetectRenderer({ width: 10, height: 10, transparent: true,
                                           resolution: Math.min(window.devicePixelRatio || 1, 2), autoResize: true });
const scene = new PIXI.Container();
let dessin = null, carte = null, filtre = null;
let ampleur = reglages.repos, dernier = 0, enCours = false;
let fige = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const lisse = (f, dt) => 1 - Math.pow(1 - f, dt);   // même inertie quelle que soit la cadence de l'écran

// La toile se pose exactement sur l'image fixe ; le dessin y est entier et centré, comme elle.
function placer() {
  const l = imageFixe.offsetWidth, h = imageFixe.offsetHeight;
  if (!l || !h) return;
  rendu.resize(l, h);
  rendu.view.style.left = imageFixe.offsetLeft + "px"; rendu.view.style.top = imageFixe.offsetTop + "px";
  if (!dessin) return;
  const k = Math.min(l / reglages.image.largeur, h / reglages.image.hauteur);
  dessin.width = reglages.image.largeur * k; dessin.height = reglages.image.hauteur * k;
  dessin.x = l / 2; dessin.y = h / 2;
  if (!enCours && rendu.view.parentNode) rendu.render(scene);
}

function image(maintenant) {
  if (fige) { enCours = false; return; }   // gravure figée : on ne redessine plus rien
  const dt = Math.min(3, (maintenant - dernier) / 16.7 || 1); dernier = maintenant;
  const enLecture = lecteurs.some(l => !l.audio.paused);
  ampleur += ((enLecture ? reglages.musique : reglages.repos) - ampleur) * lisse(0.02, dt);
  const vitesse = reglages.derive * ampleur / reglages.repos;
  carte.x += vitesse * dt; carte.y += vitesse * 0.6 * dt;
  filtre.scale.x = filtre.scale.y = ampleur;
  rendu.render(scene);
  requestAnimationFrame(image);
}
function lancer() {
  if (enCours || fige || !filtre) return;
  if (!rendu.view.parentNode) {   // au premier lancement, le dessin animé remplace l'image fixe
    placer(); rendu.render(scene);
    figure.appendChild(rendu.view); imageFixe.style.visibility = "hidden";
  }
  enCours = true; dernier = performance.now(); requestAnimationFrame(image);
}

const chargeur = new PIXI.loaders.Loader();
chargeur.add("dessin", reglages.image.src).add("carte", reglages.carte);
chargeur.load((_, ressources) => {
  carte = new PIXI.Sprite(ressources.carte.texture);
  carte.width = carte.height = reglages.taille;
  carte.texture.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
  dessin = new PIXI.Sprite(ressources.dessin.texture);
  dessin.anchor.set(0.5);
  filtre = new PIXI.filters.DisplacementFilter(carte, reglages.repos);
  dessin.filters = [filtre];
  scene.addChild(dessin, carte);
  lancer();
});
imageFixe.addEventListener("load", placer);
window.addEventListener("resize", placer);

const majFiger = () => { boutonFiger.textContent = fige ? "Relancer le fond" : "Figer le fond"; };
boutonFiger.addEventListener("click", () => { fige = !fige; majFiger(); lancer(); });
majFiger();
