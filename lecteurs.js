// Un lecteur par morceau, à la place de celui du navigateur.
// Lancer un morceau met les autres en pause ; le volume est commun à toute la page.
const mmss = s => isFinite(s) ? Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0") : "0:00";
const enSecondes = t => t.split(":").reduce((total, n) => total * 60 + (+n || 0), 0);

const ICONES =
  '<button type="button" class="b-lecture">' +
    '<svg class="lire" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1.5v13l11-6.5z"/></svg>' +
    '<svg class="pause" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1.5h3.5v13H3zM9.5 1.5H13v13H9.5z"/></svg>' +
  '</button>' +
  '<span class="temps"></span>' +
  '<input type="range" class="position" min="0" max="1000" step="1" value="0" aria-label="Position dans le morceau">' +
  '<button type="button" class="b-son">' +
    '<svg class="son" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 6h3L9 2.5v11L4.5 10h-3z"/><path d="M11.2 5.3a3.8 3.8 0 0 1 0 5.4M13 3.4a6.5 6.5 0 0 1 0 9.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>' +
    '<svg class="muet" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 6h3L9 2.5v11L4.5 10h-3z"/><path d="M11.3 6l3.4 4M14.7 6l-3.4 4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>' +
  '</button>' +
  '<input type="range" class="volume" min="0" max="1" step="0.01" value="1" aria-label="Volume">';

const lecteurs = [];
let volume = 1, sonCoupe = false;

function appliquerVolume() {
  const muet = sonCoupe || volume === 0;
  lecteurs.forEach(({ audio, barre }) => {
    audio.volume = volume;
    audio.muted = muet;
    barre.querySelector(".volume").value = volume;
    const bouton = barre.querySelector(".b-son");
    bouton.classList.toggle("coupe", muet);
    bouton.setAttribute("aria-label", muet ? "Remettre le son" : "Couper le son");
  });
}

document.querySelectorAll(".morceau").forEach(morceau => {
  const audio = morceau.querySelector("audio");
  if (!audio) return;
  const titre = morceau.querySelector(".titre").textContent.trim();
  const dureeAnnoncee = enSecondes(morceau.querySelector(".duree").textContent.trim());

  audio.removeAttribute("controls");
  const barre = document.createElement("div");
  barre.className = "lecteur";
  barre.innerHTML = ICONES;
  audio.after(barre);
  lecteurs.push({ audio, barre });

  const boutonLecture = barre.querySelector(".b-lecture"), temps = barre.querySelector(".temps"),
        position = barre.querySelector(".position");
  // tant que le fichier n'a pas annoncé sa durée, on prend celle qui est écrite dans la page
  const duree = () => isFinite(audio.duration) && audio.duration > 0 ? audio.duration : dureeAnnoncee;
  let enGlissement = false;

  function maj() {
    temps.textContent = mmss(audio.currentTime) + " / " + mmss(duree());
    if (!enGlissement && duree()) position.value = Math.round(1000 * audio.currentTime / duree());
  }
  function majBouton() {
    barre.classList.toggle("en-lecture", !audio.paused);
    boutonLecture.setAttribute("aria-label", (audio.paused ? "Lire " : "Mettre en pause ") + titre);
  }

  boutonLecture.addEventListener("click", () => { if (audio.paused) audio.play(); else audio.pause(); });
  audio.addEventListener("play", () => lecteurs.forEach(autre => { if (autre.audio !== audio) autre.audio.pause(); }));
  ["play", "pause", "ended"].forEach(ev => audio.addEventListener(ev, majBouton));
  ["timeupdate", "loadedmetadata", "durationchange", "ended"].forEach(ev => audio.addEventListener(ev, maj));

  // pendant qu'on tire le curseur, l'heure suit le doigt ; le morceau ne saute qu'au lâcher
  position.addEventListener("input", () => {
    enGlissement = true;
    temps.textContent = mmss(duree() * position.value / 1000) + " / " + mmss(duree());
  });
  position.addEventListener("change", () => {
    const cible = duree() * position.value / 1000;
    if (audio.readyState >= 1) audio.currentTime = cible;
    else { audio.addEventListener("loadedmetadata", () => { audio.currentTime = cible; }, { once: true }); audio.load(); }
    enGlissement = false;
  });

  barre.querySelector(".b-son").addEventListener("click", () => {
    if (!sonCoupe && volume === 0) volume = 1; else sonCoupe = !sonCoupe;
    appliquerVolume();
  });
  barre.querySelector(".volume").addEventListener("input", e => { volume = +e.target.value; sonCoupe = false; appliquerVolume(); });

  maj(); majBouton();
});
appliquerVolume();
