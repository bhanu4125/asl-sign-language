/**
 * SignAI Assistant - Real-Time Browser Client
 * MediaPipe Hands tracking, letter stabilization, and API orchestration.
 */

// DOM Elements
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const placeholder = document.getElementById('placeholder');
const toggleCameraBtn = document.getElementById('toggle-camera-btn');
const cameraStatus = document.getElementById('camera-status');
const handMode = document.getElementById('hand-mode');
const hud = document.getElementById('hud');
const hudLetter = document.getElementById('hud-letter');
const hudProgress = document.getElementById('hud-progress');
const heroLetter = document.getElementById('hero-letter');
const heroConfidence = document.getElementById('hero-confidence');
const holdPercentage = document.getElementById('hold-percentage');
const holdProgressFill = document.getElementById('hold-progress-fill');
const formedText = document.getElementById('formed-text');
const translatedText = document.getElementById('translated-text');
const langSelect = document.getElementById('lang-select');
const suggestionsList = document.getElementById('suggestions-list');
const fpsCounter = document.getElementById('fps-counter');

// State Variables
let camera = null;
let handsDetector = null;
let isCameraRunning = false;
let lastPredictTime = 0;
const PREDICT_INTERVAL_MS = 120; // 8-10 predictions/sec

// Gesture Stabilization Settings (Matches inference_classifier.py)
let candidateLetter = "";
let letterStableStart = 0;
const LETTER_HOLD_THRESHOLD_SEC = 1.5;

// Two-Hand Space Settings
let twoHandsStart = 0;
const TWO_HANDS_HOLD_THRESHOLD_SEC = 0.5;
let lastSpaceTime = 0;
const SPACE_COOLDOWN_SEC = 1.0;

// FPS tracking
let frameCount = 0;
let lastFpsUpdate = performance.now();

// Language mapping to SpeechSynthesis tags
const TTS_LANG_MAP = {
    'en': 'en-US',
    'te': 'te-IN',
    'hi': 'hi-IN',
    'ta': 'ta-IN',
    'de': 'de-DE',
    'es': 'es-ES',
    'fr': 'fr-FR',
    'kn': 'kn-IN',
    'ml': 'ml-IN'
};

/* ==========================================================================
   MediaPipe Initialization
   ========================================================================== */
function initMediaPipe() {
    handsDetector = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    handsDetector.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    handsDetector.onResults(onHandResults);
}

/* ==========================================================================
   Camera Management
   ========================================================================== */
async function toggleCamera() {
    if (isCameraRunning) {
        stopCamera();
    } else {
        await startCamera();
    }
}

async function startCamera() {
    try {
        if (!handsDetector) {
            initMediaPipe();
        }

        camera = new Camera(videoElement, {
            onFrame: async () => {
                if (isCameraRunning) {
                    await handsDetector.send({ image: videoElement });
                }
            },
            width: 640,
            height: 480
        });

        await camera.start();
        isCameraRunning = true;

        // UI Updates
        placeholder.style.display = 'none';
        hud.style.display = 'flex';
        cameraStatus.className = 'status-pill active';
        cameraStatus.querySelector('.status-text').textContent = 'Live Feed';
        toggleCameraBtn.classList.replace('btn-primary', 'btn-danger');
        toggleCameraBtn.querySelector('span').textContent = 'Stop Camera';

    } catch (err) {
        console.error("Camera access failed:", err);
        alert("Camera permission denied or camera unavailable. Please grant permission in your browser.");
        stopCamera();
    }
}

function stopCamera() {
    isCameraRunning = false;
    if (camera) {
        camera.stop();
        camera = null;
    }
    const stream = videoElement.srcObject;
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
    }

    // Reset UI
    placeholder.style.display = 'flex';
    hud.style.display = 'none';
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    cameraStatus.className = 'status-pill offline';
    cameraStatus.querySelector('.status-text').textContent = 'Camera Off';
    toggleCameraBtn.classList.replace('btn-danger', 'btn-primary');
    toggleCameraBtn.querySelector('span').textContent = 'Start Camera';
    handMode.textContent = 'No Hand Detected';
    resetHoldState();
}

/* ==========================================================================
   Gesture Recognition & Canvas Rendering
   ========================================================================== */
function onHandResults(results) {
    // Canvas sizing
    if (canvasElement.width !== videoElement.videoWidth) {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    const now = performance.now();
    updateFps(now);

    const numHands = results.multiHandLandmarks ? results.multiHandLandmarks.length : 0;

    if (numHands === 0) {
        handMode.textContent = "No Hand Detected";
        resetHoldState();
        canvasCtx.restore();
        return;
    }

    // Draw hand skeleton on canvas
    for (const landmarks of results.multiHandLandmarks) {
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00f2fe', lineWidth: 3 });
        drawLandmarks(canvasCtx, landmarks, { color: '#ffffff', fillColor: '#3b82f6', lineWidth: 2, radius: 4 });
    }

    // Case 1: Two hands detected -> Spacebar gesture
    if (numHands === 2) {
        handMode.textContent = "Two Hands (Hold for Space)";
        handleTwoHandsSpace(now);
    } 
    // Case 2: One hand detected -> Predict letter
    else if (numHands === 1) {
        handMode.textContent = "1 Hand (Active)";
        twoHandsStart = 0; // reset space timer

        if (now - lastPredictTime >= PREDICT_INTERVAL_MS) {
            lastPredictTime = now;
            requestPrediction(results.multiHandLandmarks[0], now);
        } else {
            // Smoothly update hold progress between API responses
            renderHoldProgress(now);
        }
    }

    canvasCtx.restore();
}

/* ==========================================================================
   Two-Hand Space Handling
   ========================================================================== */
function handleTwoHandsSpace(now) {
    if (twoHandsStart === 0) {
        twoHandsStart = now;
    }

    const elapsedSec = (now - twoHandsStart) / 1000;
    const progress = Math.min(1.0, elapsedSec / TWO_HANDS_HOLD_THRESHOLD_SEC);
    updateProgressUI(progress, "SPACE");

    if (elapsedSec >= TWO_HANDS_HOLD_THRESHOLD_SEC && ((now - lastSpaceTime) / 1000 >= SPACE_COOLDOWN_SEC)) {
        addSpace();
        lastSpaceTime = now;
        twoHandsStart = now; // reset
    }
}

/* ==========================================================================
   Single-Hand Letter Prediction & Stabilization
   ========================================================================== */
async function requestPrediction(landmarks, now) {
    try {
        const response = await fetch('/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ landmarks: landmarks })
        });

        if (!response.ok) return;

        const data = await response.json();
        const letter = data.letter;
        const confidence = data.confidence || 1.0;

        if (letter === candidateLetter) {
            if (letterStableStart === 0) {
                letterStableStart = now;
            }
            renderHoldProgress(now);

            const heldSec = (now - letterStableStart) / 1000;
            if (heldSec >= LETTER_HOLD_THRESHOLD_SEC) {
                commitLetter(letter);
                letterStableStart = now;
            }
        } else {
            candidateLetter = letter;
            letterStableStart = now;
            updateHero(letter, confidence);
            renderHoldProgress(now);
        }

    } catch (err) {
        console.error("Predict error:", err);
    }
}

function renderHoldProgress(now) {
    if (letterStableStart === 0) {
        updateProgressUI(0, candidateLetter);
        return;
    }
    const elapsedSec = (now - letterStableStart) / 1000;
    const progress = Math.min(1.0, elapsedSec / LETTER_HOLD_THRESHOLD_SEC);
    updateProgressUI(progress, candidateLetter);
}

function updateProgressUI(progress, label) {
    const percentage = Math.round(progress * 100);
    holdPercentage.textContent = `${percentage}%`;
    holdProgressFill.style.width = `${percentage}%`;
    hudProgress.style.width = `${percentage}%`;

    if (label) {
        hudLetter.textContent = label;
    }
}

function updateHero(letter, confidence) {
    heroLetter.textContent = letter;
    hudLetter.textContent = letter;
    heroConfidence.textContent = `Confidence: ${(confidence * 100).toFixed(0)}%`;
}

function resetHoldState() {
    candidateLetter = "";
    letterStableStart = 0;
    twoHandsStart = 0;
    updateProgressUI(0, "-");
    heroLetter.textContent = "-";
    heroConfidence.textContent = "Confidence: --%";
}

/* ==========================================================================
   Text Formation, Suggestions & Translation
   ========================================================================== */
function commitLetter(letter) {
    formedText.value += letter;
    triggerTextChange();
}

function addSpace() {
    if (formedText.value.length > 0 && !formedText.value.endsWith(' ')) {
        formedText.value += ' ';
        triggerTextChange();
    }
}

function backspaceText() {
    formedText.value = formedText.value.slice(0, -1);
    triggerTextChange();
}

function clearText() {
    formedText.value = "";
    translatedText.textContent = "Translations will update dynamically...";
    suggestionsList.innerHTML = '<span class="no-suggestions">Spell suggestions appear here as you sign</span>';
    resetHoldState();
}

function copyText() {
    if (!formedText.value) return;
    navigator.clipboard.writeText(formedText.value);
    alert("Text copied to clipboard!");
}

let translationTimeout = null;
function triggerTextChange() {
    clearTimeout(translationTimeout);

    // Auto-scroll textarea to bottom
    formedText.scrollTop = formedText.scrollHeight;

    // Fetch word suggestions for last word
    fetchSuggestions();

    // Debounce translation by 400ms
    translationTimeout = setTimeout(triggerTranslation, 400);
}

async function fetchSuggestions() {
    const words = formedText.value.trim().split(/\s+/);
    const lastWord = words[words.length - 1];

    if (!lastWord || lastWord.length < 2) {
        suggestionsList.innerHTML = '<span class="no-suggestions">Spell suggestions appear here as you sign</span>';
        return;
    }

    try {
        const res = await fetch('/suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word: lastWord })
        });
        const data = await res.json();
        renderSuggestions(data.suggestions || [], lastWord);
    } catch (err) {
        console.error("Suggestions error:", err);
    }
}

function renderSuggestions(suggestions, currentWord) {
    if (!suggestions || suggestions.length === 0) {
        suggestionsList.innerHTML = '<span class="no-suggestions">No suggestions for current word</span>';
        return;
    }

    suggestionsList.innerHTML = '';
    suggestions.forEach(word => {
        const chip = document.createElement('button');
        chip.className = 'suggestion-chip';
        chip.textContent = word;
        chip.onclick = () => applySuggestion(word, currentWord);
        suggestionsList.appendChild(chip);
    });
}

function applySuggestion(chosenWord, targetWord) {
    const text = formedText.value;
    const lastIndex = text.lastIndexOf(targetWord);
    if (lastIndex !== -1) {
        formedText.value = text.substring(0, lastIndex) + chosenWord + " ";
        triggerTextChange();
    }
}

async function triggerTranslation() {
    const text = formedText.value.trim();
    const targetLang = langSelect.value;

    if (!text) {
        translatedText.textContent = "Translations will update dynamically...";
        return;
    }

    try {
        const res = await fetch('/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, target_lang: targetLang })
        });
        const data = await res.json();
        translatedText.textContent = data.translated_text || "(No translation available)";
    } catch (err) {
        console.error("Translation error:", err);
    }
}

/* ==========================================================================
   Text-to-Speech (Web Speech API)
   ========================================================================== */
function speakOriginal() {
    const text = formedText.value.trim();
    if (!text) return;
    speakWithBrowser(text, 'en-US');
}

function speakTranslated() {
    const text = translatedText.textContent.trim();
    if (!text || text.startsWith('Translations')) return;

    const targetLang = langSelect.value;
    const voiceLang = TTS_LANG_MAP[targetLang] || 'en-US';
    speakWithBrowser(text, voiceLang);
}

function speakWithBrowser(text, lang) {
    if (!('speechSynthesis' in window)) {
        alert("Text-to-Speech is not supported in this browser.");
        return;
    }

    window.speechSynthesis.cancel(); // Stop any pending speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.95;

    // Try to find matching voice
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith(lang.substring(0, 2)));
    if (voice) {
        utterance.voice = voice;
    }

    window.speechSynthesis.speak(utterance);
}

/* ==========================================================================
   FPS Counter
   ========================================================================== */
function updateFps(now) {
    frameCount++;
    if (now - lastFpsUpdate >= 1000) {
        fpsCounter.textContent = frameCount;
        frameCount = 0;
        lastFpsUpdate = now;
    }
}
