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
                    darken: 0.25              // assombrit le fond pour que le texte blanc reste lisible
                  }
};
const dm = options.displacementMap;

let ww = window.innerWidth, wh = window.innerHeight;
const renderer = new PIXI.autoDetectRenderer({ width: ww, height: wh });
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
const player = document.getElementById("player");

player.addEventListener("play", () => {
  if (analyser) { if (audioCtx.state === "suspended") audioCtx.resume(); return; }
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const src = audioCtx.createMediaElementSource(player);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.6;
  analyser.minDecibels = -75; analyser.maxDecibels = -15;
  src.connect(analyser);
  analyser.connect(audioCtx.destination);
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

const mesure = document.getElementById("mesure");
const ticker = new PIXI.ticker.Ticker();
ticker.add(deltaTime => {
  if (fige) { renderer.render(stage); return; }
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
    if (mesure) mesure.textContent = "grave : " + eScale.toFixed(2) + " · distorsion : " + scale.toFixed(0)
      + " · glissement : " + Math.hypot(vx, vy).toFixed(1);
  }
  renderer.render(stage);
});
ticker.start();

window.addEventListener("resize", () => {
  ww = window.innerWidth; wh = window.innerHeight;
  renderer.resize(ww, wh);
  if (bg) coverBg();
});

// --- Panneau de réglage (provisoire, à retirer avant publication) ---
[["darken", 2], ["intensity", 0], ["reaction", 2], ["mouseDelay", 3], ["speed", 3], ["size", 0]].forEach(([nom, dec]) => {
  const curseur = document.getElementById("s-" + nom), valeur = document.getElementById("v-" + nom);
  if (!curseur) return;
  curseur.value = dm[nom]; valeur.textContent = (+dm[nom]).toFixed(dec);
  curseur.addEventListener("input", () => {
    dm[nom] = +curseur.value; valeur.textContent = dm[nom].toFixed(dec);
    if (nom === "size" && dispMap) { dispMap.width = dm.size; dispMap.height = dm.size; }
    if (nom === "darken") assombrir();
  });
});
const boutonFiger = document.getElementById("b-figer");
if (boutonFiger) boutonFiger.addEventListener("click", () => {
  fige = !fige;
  boutonFiger.classList.toggle("actif", fige);
  boutonFiger.textContent = fige ? "Relancer le mouvement" : "Figer l'image";
});
window.addEventListener("keydown", e => {
  if (e.key === "r" || e.key === "R") {
    const p = document.getElementById("reglages");
    if (p) p.style.display = p.style.display === "none" ? "" : "none";
  }
});
