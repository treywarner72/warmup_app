// Exercises
const exercises = [
    { id: 0, name: 'Dead Hang', duration: 60 },
    { id: 1, name: 'Reverse Hang', duration: 60 },
    { id: 2, name: 'Dip Hold', duration: 60 },
    { id: 3, name: 'Farmer\'s Carry', duration: 60 },
    { id: 4, name: 'Leg Straddle', duration: 60 },
    { id: 5, name: 'Wall Hold', duration: 60 }
];

const REST_DURATION = 60;
const WARNING_THRESHOLD = 5;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 90; // 565.48

// State
let state = 'notStarted'; // notStarted, exercise, rest, paused, completed
let currentExerciseIndex = 0;
let remainingTime = 0;
let isPaused = false;
let pausedFrom = null;
let timerInterval = null;
let hasPlayedWarning = false;

// Audio context for sounds
let audioContext = null;

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

function playBeep(frequency, duration, type = 'sine') {
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

function playBuzzer() {
    playBeep(440, 0.3, 'square');
    setTimeout(() => playBeep(440, 0.3, 'square'), 150);
}

function playWarningBeep() {
    playBeep(880, 0.15, 'sine');
}

function playSuccess() {
    playBeep(523, 0.15, 'sine');
    setTimeout(() => playBeep(659, 0.15, 'sine'), 150);
    setTimeout(() => playBeep(784, 0.3, 'sine'), 300);
}

// DOM Elements
const screens = {
    main: document.getElementById('main-screen'),
    exercise: document.getElementById('exercise-screen'),
    rest: document.getElementById('rest-screen'),
    completion: document.getElementById('completion-screen')
};

const elements = {
    exerciseList: document.getElementById('exercise-list'),
    startBtn: document.getElementById('start-btn'),
    exerciseName: document.getElementById('exercise-name'),
    timerDisplay: document.getElementById('timer-display'),
    progressCircle: document.getElementById('progress-circle'),
    progressLabel: document.getElementById('progress-label'),
    pauseBtn: document.getElementById('pause-btn'),
    restTitle: document.getElementById('rest-title'),
    restTimerDisplay: document.getElementById('rest-timer-display'),
    restProgressCircle: document.getElementById('rest-progress-circle'),
    nextExerciseName: document.getElementById('next-exercise-name'),
    restPauseBtn: document.getElementById('rest-pause-btn'),
    skipBtn: document.getElementById('skip-btn'),
    restartBtn: document.getElementById('restart-btn'),
    exitBtn: document.getElementById('exit-btn')
};

// Screen management
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// Render exercise list
function renderExerciseList() {
    elements.exerciseList.innerHTML = exercises.map((exercise, index) => {
        let statusClass = '';
        if (state !== 'notStarted' && state !== 'completed') {
            if (index < currentExerciseIndex) {
                statusClass = 'completed';
            } else if (index === currentExerciseIndex) {
                statusClass = 'current';
            }
        }
        if (state === 'completed') {
            statusClass = 'completed';
        }

        return `
            <li class="exercise-item ${statusClass}">
                <div class="exercise-number">
                    <span>${index + 1}</span>
                    <svg class="checkmark" width="20" height="20" viewBox="0 0 20 20">
                        <path d="M5 10 L8 13 L15 6" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="exercise-info">
                    <h3>${exercise.name}</h3>
                    <span>${exercise.duration} seconds</span>
                </div>
            </li>
        `;
    }).join('');
}

// Format time as M:SS
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Update progress ring
function updateProgressRing(circle, progress, isWarning = false) {
    const offset = CIRCLE_CIRCUMFERENCE * (1 - progress);
    circle.style.strokeDasharray = CIRCLE_CIRCUMFERENCE;
    circle.style.strokeDashoffset = offset;

    if (isWarning) {
        circle.classList.add('warning');
    } else {
        circle.classList.remove('warning');
    }
}

// Timer tick
function tick() {
    remainingTime--;

    const isWarning = remainingTime <= WARNING_THRESHOLD && remainingTime > 0;

    if (isWarning && remainingTime > 0) {
        playWarningBeep();
    }

    updateUI();

    if (remainingTime <= 0) {
        handleTimerComplete();
    }
}

// Update UI based on state
function updateUI() {
    const isWarning = remainingTime <= WARNING_THRESHOLD && remainingTime > 0;

    if (state === 'exercise' || (isPaused && pausedFrom === 'exercise')) {
        const exercise = exercises[currentExerciseIndex];
        const total = exercise.duration;
        const progress = 1 - (remainingTime / total);

        elements.exerciseName.textContent = exercise.name;
        elements.timerDisplay.textContent = formatTime(remainingTime);
        elements.progressLabel.textContent = `${currentExerciseIndex + 1} of ${exercises.length}`;
        updateProgressRing(elements.progressCircle, progress, isWarning);

        elements.exerciseName.classList.toggle('warning', isWarning);
        elements.timerDisplay.classList.toggle('warning', isWarning);
    }

    if (state === 'rest' || (isPaused && pausedFrom === 'rest')) {
        const progress = 1 - (remainingTime / REST_DURATION);

        elements.restTimerDisplay.textContent = formatTime(remainingTime);
        updateProgressRing(elements.restProgressCircle, progress, isWarning);

        if (currentExerciseIndex + 1 < exercises.length) {
            elements.nextExerciseName.textContent = exercises[currentExerciseIndex + 1].name;
        }

        elements.restTitle.classList.toggle('warning', isWarning);
        elements.restTimerDisplay.classList.toggle('warning', isWarning);
    }

    // Update pause buttons
    const pauseBtn = state === 'rest' ? elements.restPauseBtn : elements.pauseBtn;
    if (isPaused) {
        pauseBtn.textContent = 'Resume';
        pauseBtn.classList.remove('pause');
        pauseBtn.classList.add('resume');
    } else {
        pauseBtn.textContent = 'Pause';
        pauseBtn.classList.remove('resume');
        pauseBtn.classList.add('pause');
    }

    renderExerciseList();
}

// Handle timer completion
function handleTimerComplete() {
    clearInterval(timerInterval);
    timerInterval = null;
    playBuzzer();

    if (state === 'exercise') {
        if (currentExerciseIndex < exercises.length - 1) {
            // Move to rest
            state = 'rest';
            remainingTime = REST_DURATION;
            hasPlayedWarning = false;
            showScreen('rest');
            updateUI();
            startTimer();
        } else {
            // Workout complete
            state = 'completed';
            playSuccess();
            showScreen('completion');
            renderExerciseList();
        }
    } else if (state === 'rest') {
        // Move to next exercise
        currentExerciseIndex++;
        state = 'exercise';
        remainingTime = exercises[currentExerciseIndex].duration;
        hasPlayedWarning = false;
        showScreen('exercise');
        updateUI();
        startTimer();
    }
}

// Start timer
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tick, 1000);
}

// Start workout
function startWorkout() {
    initAudio();
    state = 'exercise';
    currentExerciseIndex = 0;
    remainingTime = exercises[0].duration;
    isPaused = false;
    hasPlayedWarning = false;

    showScreen('exercise');
    updateUI();
    startTimer();
}

// Pause/Resume
function togglePause() {
    if (isPaused) {
        // Resume
        isPaused = false;
        if (pausedFrom === 'exercise') {
            state = 'exercise';
        } else {
            state = 'rest';
        }
        startTimer();
    } else {
        // Pause
        clearInterval(timerInterval);
        timerInterval = null;
        isPaused = true;
        pausedFrom = state;
        state = 'paused';
    }
    updateUI();
}

// Restart
function restart() {
    clearInterval(timerInterval);
    timerInterval = null;
    state = 'notStarted';
    currentExerciseIndex = 0;
    remainingTime = 0;
    isPaused = false;
    hasPlayedWarning = false;
    renderExerciseList();
}

// Event listeners
elements.startBtn.addEventListener('click', startWorkout);
elements.pauseBtn.addEventListener('click', togglePause);
elements.restPauseBtn.addEventListener('click', togglePause);
elements.restartBtn.addEventListener('click', () => {
    restart();
    startWorkout();
});
elements.exitBtn.addEventListener('click', () => {
    restart();
    showScreen('main');
});
elements.skipBtn.addEventListener('click', () => {
    if (state === 'rest' || (isPaused && pausedFrom === 'rest')) {
        remainingTime = WARNING_THRESHOLD;
        hasPlayedWarning = false;
        updateUI();
    }
});

// Handle visibility change (background/foreground)
let hiddenTime = null;

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        hiddenTime = Date.now();
    } else if (hiddenTime && (state === 'exercise' || state === 'rest')) {
        const elapsed = Math.floor((Date.now() - hiddenTime) / 1000);
        remainingTime = Math.max(0, remainingTime - elapsed);
        hiddenTime = null;

        if (remainingTime <= 0) {
            handleTimerComplete();
        } else {
            updateUI();
        }
    }
});

// Prevent screen sleep on mobile (request wake lock if available)
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            await navigator.wakeLock.request('screen');
        } catch (e) {
            // Wake lock not available or denied
        }
    }
}

// Initialize
renderExerciseList();

// Register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}
