// Fond réactif de la page Bulldozer : base adaptée de Chatonsky,
// distorsion pilotée par la souris et par le grave du morceau.

const options = {
  bg:             { src: "bulldozer-bg.jpg", width: 1920, height: 1080 },
  displacementMap:{ src: "normal.jpg",
                    intensity: 100,
                    reaction: 0.35,           // poids de la musique dans la distorsion
                    mouseDelay: 0.005,
                    speed: 0.05,
                    size: 500,
                    wrapMode: PIXI.WRAP_MODES.REPEAT,
                    darken: 0.1               // léger assombrissement : le titre et les crédits sont en brun foncé
                  }
};
const dm = options.displacementMap;

let ww = window.innerWidth, wh = window.innerHeight;
const renderer = new PIXI.autoDetectRenderer({ width: ww, height: wh, transparent: true });   // transparent : l'image fixe reste visible tant que le fond animé n'est pas prêt
document.querySelector("#root").appendChild(renderer.view);
const stage = new PIXI.Container();

// le fond couvre toujours la fenêtre, quel que soit son format
function coverBg() {
  const k = Math.max((ww + 100) / options.bg.width, (wh + 100) / options.bg.height);
  bg.x = ww / 2; bg.y = wh / 2;
  bg.width = options.bg.width * k; bg.height = options.bg.height * k;
}

let bg, dispMap, filter;
// teinte grise appliquée au fond : 0 = image telle quelle, 0.7 = très sombre
function assombrir() {
  const g = Math.round(255 * (1 - dm.darken));
  if (bg) bg.tint = (g << 16) | (g << 8) | g;
}
const loader = new PIXI.loaders.Loader();
loader.add("bg", options.bg.src).add("disp", dm.src);
loader.load((_, { bg: bgRes, disp: dispRes }) => {
  dispMap = new PIXI.Sprite(dispRes.texture);
  dispMap.width = dm.size; dispMap.height = dm.size;
  dispMap.texture.baseTexture.wrapMode = dm.wrapMode;

  bg = new PIXI.Sprite(bgRes.texture);
  bg.anchor.set(0.5);
  coverBg();
  filter = new PIXI.filters.DisplacementFilter(dispMap, dm.intensity);
  bg.filters = [filter];
  assombrir();
  stage.addChild(bg, dispMap);
});

// --- Analyse audio : la distorsion suit le morceau ---
let analyser = null, freqData = null, bassBins = 8, audioCtx = null;
let gainSortie = null, volumeVoulu = 1, sonCoupe = false;   // volume d'écoute, réglé après l'analyse
const player = document.getElementById("player");

player.addEventListener("play", () => {
  if (analyser) { if (audioCtx.state === "suspended") audioCtx.resume(); return; }
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const src = audioCtx.createMediaElementSource(player);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.6;
  analyser.minDecibels = -75; analyser.maxDecibels = -15;
  gainSortie = audioCtx.createGain();
  gainSortie.gain.value = sonCoupe ? 0 : volumeVoulu;
  src.connect(analyser);
  analyser.connect(gainSortie);
  gainSortie.connect(audioCtx.destination);
  freqData = new Uint8Array(analyser.frequencyBinCount);
  // nombre de bandes couvrant 0-350 Hz : le moteur, le sub et la chute
  bassBins = Math.max(2, Math.round(350 / (audioCtx.sampleRate / analyser.fftSize)));
});

// énergie des graves (0-1)
function bassEnergy() {
  if (!analyser || player.paused) return 0;
  analyser.getByteFrequencyData(freqData);
  let sum = 0;
  for (let i = 1; i <= bassBins; i++) sum += freqData[i];
  return sum / (bassBins * 255);
}

let oldX = 0, oldY = 0, currentX = 0, currentY = 0;
window.addEventListener("mousemove", e => { currentX = e.pageX; currentY = e.pageY; });

// La musique agit comme une main sur la souris : le niveau du grave donne une vitesse
// de croisière au glissement, et chaque élan (ce qui dépasse la moyenne récente) relance
// le geste, parfois dans une autre direction. Rien ne saute : tout passe par de l'inertie.
let eFast = 0, eSlow = 0, eScale = 0, vx = 0, vy = 0, angle = 0.7, enElan = false;
let fige = false;   // image figée : plus aucun mouvement, ni souris, ni musique
const lisse = (f, dt) => 1 - Math.pow(1 - f, dt);   // même inertie quelle que soit la cadence de l'écran

const ticker = new PIXI.ticker.Ticker();
ticker.add(deltaTime => {
  if (fige) return;   // image figée : on ne redessine plus rien
  const dt = Math.min(deltaTime, 3);
  const diffX = currentX - oldX, diffY = currentY - oldY;

  // le grave du morceau occupe surtout 0,45-0,78 sur l'échelle de l'analyseur : on étire cette plage
  const en = Math.min(1, Math.max(0, (bassEnergy() - 0.45) / 0.33));
  eFast += (en - eFast) * lisse(en > eFast ? 0.30 : 0.05, dt);
  eSlow += (en - eSlow) * lisse(0.01, dt);
  eScale += (en - eScale) * lisse(en > eScale ? 0.06 : 0.015, dt);
  const elan = Math.max(0, eFast - eSlow);
  if (elan > 0.10 && !enElan) { angle += 2.4; enElan = true; } else if (elan < 0.04) enElan = false;
  angle += 0.006 * dt;
  const croisiere = dm.reaction * (1.5 * Math.min(1, eScale * 4) + 9 * Math.pow(eScale, 1.5));
  const pousse = dm.reaction * elan * 1.6;
  vx += ((Math.cos(angle) * croisiere - vx) * 0.04 + Math.cos(angle) * pousse) * dt;
  vy += ((Math.sin(angle) * croisiere - vy) * 0.04 + Math.sin(angle) * pousse) * dt;

  if (dispMap) {
    dispMap.x += (dm.speed + vx) * dt - diffX * dm.mouseDelay;
    dispMap.y += (-dm.speed + vy) * dt + diffY * dm.mouseDelay;
  }
  oldX += diffX * dm.mouseDelay;
  oldY += diffY * dm.mouseDelay;

  if (filter) {
    const scale = dm.intensity * (0.6 + dm.reaction * 1.6 * Math.pow(eScale, 1.5));
    filter.scale.x = scale; filter.scale.y = scale;
  }
  renderer.render(stage);
});
ticker.start();

window.addEventListener("resize", () => {
  ww = window.innerWidth; wh = window.innerHeight;
  renderer.resize(ww, wh);
  if (bg) coverBg();
  renderer.render(stage);
});

// --- Réglages offerts au visiteur ---
[["darken", 2], ["intensity", 0], ["reaction", 2]].forEach(([nom]) => {
  const curseur = document.getElementById("s-" + nom);
  if (!curseur) return;
  curseur.value = dm[nom];
  curseur.addEventListener("input", () => {
    dm[nom] = +curseur.value;
    if (nom === "darken") assombrir();
  });
});
const boutonFiger = document.getElementById("b-figer");
if (boutonFiger) boutonFiger.addEventListener("click", () => {
  fige = !fige;
  boutonFiger.classList.toggle("actif", fige);
  boutonFiger.textContent = fige ? "Relancer le mouvement" : "Figer l'image";
});
// le panneau est fermé à l'arrivée : le bouton « Réglages » ou la touche R l'ouvre et le referme
const panneau = document.getElementById("reglages"), boutonReglages = document.getElementById("b-reglages");
function basculerReglages() {
  if (!panneau) return;
  panneau.hidden = !panneau.hidden;
  if (boutonReglages) boutonReglages.setAttribute("aria-expanded", String(!panneau.hidden));
}
if (boutonReglages) boutonReglages.addEventListener("click", basculerReglages);
window.addEventListener("keydown", e => {
  if (e.key === "r" || e.key === "R") basculerReglages();
});

// --- Lecteur : une barre aux couleurs de la page, qui pilote l'élément audio ---
const boutonLecture = document.getElementById("b-lecture"), curseurPosition = document.getElementById("s-position"),
      affichageTemps = document.getElementById("t-temps");
const mmss = s => isFinite(s) ? Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0") : "0:00";
let enGlissement = false;
function majLecteur() {
  if (affichageTemps) affichageTemps.textContent = mmss(player.currentTime) + " / " + mmss(player.duration);
  if (curseurPosition && !enGlissement && player.duration)
    curseurPosition.value = Math.round(1000 * player.currentTime / player.duration);
}
if (boutonLecture) {
  boutonLecture.addEventListener("click", () => { if (player.paused) player.play(); else player.pause(); });
  const majBouton = () => {
    boutonLecture.classList.toggle("en-lecture", !player.paused);
    boutonLecture.setAttribute("aria-label", player.paused ? "Lire" : "Pause");
  };
  ["play", "pause", "ended"].forEach(ev => player.addEventListener(ev, majBouton));
}
["timeupdate", "loadedmetadata", "durationchange"].forEach(ev => player.addEventListener(ev, majLecteur));
if (curseurPosition) {
  // pendant qu'on tire le curseur, l'heure suit le doigt ; le morceau ne saute qu'au lâcher
  curseurPosition.addEventListener("input", () => {
    enGlissement = true;
    if (affichageTemps && player.duration)
      affichageTemps.textContent = mmss(player.duration * curseurPosition.value / 1000) + " / " + mmss(player.duration);
  });
  curseurPosition.addEventListener("change", () => {
    if (player.duration) player.currentTime = player.duration * curseurPosition.value / 1000;
    enGlissement = false;
  });
}
majLecteur();

// volume et coupure du son : ils n'agissent que sur l'écoute, pas sur la réaction du fond
const boutonSon = document.getElementById("b-son"), curseurVolume = document.getElementById("s-volume");
function appliquerVolume() {
  const v = sonCoupe ? 0 : volumeVoulu;
  if (gainSortie) gainSortie.gain.value = v; else player.volume = v;   // avant la première lecture, le gain n'existe pas encore
  if (boutonSon) {
    boutonSon.classList.toggle("coupe", v === 0);
    boutonSon.setAttribute("aria-label", v === 0 ? "Remettre le son" : "Couper le son");
  }
}
player.addEventListener("play", () => { player.volume = 1; appliquerVolume(); });
if (boutonSon) boutonSon.addEventListener("click", () => {
  if (!sonCoupe && volumeVoulu === 0) { volumeVoulu = 1; if (curseurVolume) curseurVolume.value = 1; }
  else sonCoupe = !sonCoupe;
  appliquerVolume();
});
if (curseurVolume) curseurVolume.addEventListener("input", () => {
  volumeVoulu = +curseurVolume.value; sonCoupe = false; appliquerVolume();
});
