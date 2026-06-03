'use strict';

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabase = window.supabase.createClient(
  'https://rcpwpegdggewuhnfyxxp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcHdwZWdkZ2dld3VobmZ5eHhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MzkzOTgsImV4cCI6MjA5NjAxNTM5OH0.th-YoFns1SvQjqpQ-NGEONxMvrL0kjTjN2t5yJitXSY'
);

function getAnonId() {
  let id = localStorage.getItem('higherLowerAnonId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('higherLowerAnonId', id);
  }
  return id;
}

function getNextAttempt() {
  const n = Number(localStorage.getItem('higherLowerAttempts') || 0) + 1;
  localStorage.setItem('higherLowerAttempts', n);
  return n;
}

async function submitScore(score) {
  await supabase.from('scores').insert({
    anon_id: getAnonId(),
    score,
    attempt_number: getNextAttempt(),
  });
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const loadingOverlay  = document.getElementById('loading-overlay');
const gameoverOverlay = document.getElementById('gameover-overlay');
const gameArea        = document.getElementById('game-area');
const resultMsg       = document.getElementById('result-message');

const leftImg    = document.getElementById('left-img');
const leftName   = document.getElementById('left-name');
const leftStat   = document.getElementById('left-stat');
const rightImg   = document.getElementById('right-img');
const rightName  = document.getElementById('right-name');
const rightStat  = document.getElementById('right-stat');
const cardLeft   = document.getElementById('card-left');
const cardRight  = document.getElementById('card-right');

const scoreEl     = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const finalScoreEl     = document.getElementById('final-score');
const finalHighScoreEl = document.getElementById('final-high-score');

const btnHigher  = document.getElementById('btn-higher');
const btnLower   = document.getElementById('btn-lower');
const btnNext    = document.getElementById('btn-next');
const btnRestart = document.getElementById('btn-restart');
const poolSelect = document.getElementById('pool-select');

// ── State ─────────────────────────────────────────────────────────────────────
let allPokemon    = [];
let shuffledQueue = [];
let queueIndex    = 0;
let score         = 0;
let highScore     = Number(localStorage.getItem('higherLowerHighScore') || 0);
let poolSize      = Number(localStorage.getItem('higherLowerPoolSize')  || 500);
let gameState     = 'loading'; // loading | playing | reveal | gameover

// ── Helpers ───────────────────────────────────────────────────────────────────
function spriteURL(dex) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dex}.png`;
}

function pokeballSVGDataURI() {
  const svg = document.getElementById('pokeball-svg').outerHTML;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function setButtons(guessEnabled) {
  btnHigher.disabled = !guessEnabled;
  btnLower.disabled  = !guessEnabled;
}

function updateScoreDisplay() {
  scoreEl.textContent     = score;
  highScoreEl.textContent = highScore;
}

function setImg(imgEl, dex) {
  imgEl.src = spriteURL(dex);
  imgEl.onerror = () => { imgEl.src = pokeballSVGDataURI(); imgEl.onerror = null; };
}

// ── Pool / shuffle ────────────────────────────────────────────────────────────
function buildPool() {
  const size = Math.min(poolSize, allPokemon.length);
  return allPokemon.slice(0, size);
}

function newShuffle() {
  shuffledQueue = shuffle(buildPool());
  queueIndex    = 0;
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderLeft(pokemon, animate) {
  if (animate) {
    cardLeft.classList.remove('card-enter');
    // Force reflow so animation replays
    void cardLeft.offsetWidth;
    cardLeft.classList.add('card-enter');
    cardLeft.addEventListener('animationend', () => cardLeft.classList.remove('card-enter'), { once: true });
  }
  setImg(leftImg, pokemon.dex);
  leftName.textContent = pokemon.speciesName;
  leftStat.textContent = pokemon.attackStat.toFixed(1);
  cardLeft.classList.remove('correct', 'wrong');
}

function renderRight(pokemon) {
  setImg(rightImg, pokemon.dex);
  rightName.textContent = pokemon.speciesName;
  rightStat.textContent = '???';
  rightStat.classList.add('stat-hidden');
  rightStat.classList.remove('stat-revealed');
  cardRight.classList.remove('correct', 'wrong');
}

function revealRight(pokemon) {
  rightStat.textContent = pokemon.attackStat.toFixed(1);
  rightStat.classList.remove('stat-hidden');
  rightStat.classList.add('stat-revealed');
}

// ── Game flow ─────────────────────────────────────────────────────────────────
function startRound(animateLeft) {
  // Reshuffle when fewer than 2 cards remain
  if (queueIndex + 1 >= shuffledQueue.length) newShuffle();

  gameState = 'playing';

  const left  = shuffledQueue[queueIndex];
  const right = shuffledQueue[queueIndex + 1];

  renderLeft(left, animateLeft);
  renderRight(right);

    resultMsg.className = 'hidden';
  resultMsg.textContent = '';
  setButtons(true);
  updateScoreDisplay();
}

function handleGuess(direction) {
  if (gameState !== 'playing') return;
  gameState = 'reveal';
  setButtons(false);

  const left  = shuffledQueue[queueIndex];
  const right = shuffledQueue[queueIndex + 1];

  revealRight(right);

  const correct =
    direction === 'higher'
      ? right.attackStat >= left.attackStat
      : right.attackStat <= left.attackStat;

  if (correct) {
    score++;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('higherLowerHighScore', highScore);
    }
    updateScoreDisplay();
    cardRight.classList.add('correct');
    resultMsg.textContent = right.attackStat === left.attackStat
      ? `Tied at ${right.attackStat.toFixed(1)} — both answers correct!`
      : 'Correct!';
    resultMsg.className = 'correct-msg';
    setTimeout(() => {
      queueIndex++;
      startRound(true);
    }, 800);
  } else {
    cardRight.classList.add('wrong');
    resultMsg.textContent = `Wrong! ${right.speciesName} has ${right.attackStat.toFixed(1)} vs ${left.attackStat.toFixed(1)}`;
    resultMsg.className = 'wrong-msg';

    setTimeout(() => {
      gameState = 'gameover';
      finalScoreEl.textContent     = score;
      finalHighScoreEl.textContent = highScore;
      gameoverOverlay.classList.remove('hidden');
      submitScore(score);
    }, 1500);
  }
}


function restartGame() {
  score = 0;
  gameoverOverlay.classList.add('hidden');
  newShuffle();
  startRound(false);
}

// ── Pool size change ───────────────────────────────────────────────────────────
function applyPoolSize(value) {
  poolSize = Number(value);
  localStorage.setItem('higherLowerPoolSize', poolSize);
  score = 0;
  gameoverOverlay.classList.add('hidden');
  newShuffle();
  startRound(false);
}

// ── Init ──────────────────────────────────────────────────────────────────────
// Restore persisted pool size selection in the dropdown
poolSelect.value = String(poolSize);
// If stored value doesn't match any option, default to 500
if (!poolSelect.value) {
  poolSelect.value = '500';
  poolSize = 500;
}

fetch('./data/pokemon.json')
  .then(r => r.json())
  .then(data => {
    allPokemon = data;
    loadingOverlay.classList.add('hidden');
    newShuffle();
    startRound(false);
  })
  .catch(err => {
    loadingOverlay.innerHTML = `<p style="color:#e63946">Failed to load data.<br>${err.message}<br><small>Serve with: python3 -m http.server 8080</small></p>`;
  });

// ── Event listeners ───────────────────────────────────────────────────────────
btnHigher.addEventListener('click', () => handleGuess('higher'));
btnLower.addEventListener('click',  () => handleGuess('lower'));
btnRestart.addEventListener('click', restartGame);
poolSelect.addEventListener('change', e => applyPoolSize(e.target.value));
