// ==========================
// DATEYUMEI ENGINE & SYSTEM
// ==========================

// --------------------------
// STORY CONFIG
// --------------------------
const chapterOrder = {
    chapter1: "chapter2",
    chapter2: "chapter3",
    chapter3: "chapter4"
};

const BGM_TRACKS = {
    chapter1: "assets/audio/track1.mp3",
    chapter2: "assets/audio/track2.mp3",
    chapter3: "assets/audio/track1.mp3"
};

// --------------------------
// STATE VARIABLES
// --------------------------
let storyData = [];
let currentScene = 0;
let currentChapter = "chapter1";
let waitingForInput = false;
let waitingForChoice = false;

// Visual Novel Playback Controls
let isTyping = false;
let typingTimeout = null;
let currentFullText = "";
let isAutoPlay = false;
let autoPlayTimeout = null;
let isSkipMode = false;
let skipInterval = null;
let dialogueHistory = []; // Backlog log

// DOM elements
const sceneImage = document.getElementById("scene-image");
const speakerName = document.getElementById("speaker-name");
const storyText = document.getElementById("story-text");
const choiceContainer = document.getElementById("choice-container");
const continueIndicator = document.getElementById("continue-indicator");
const heartsDisplay = document.getElementById("hearts-display");
const bgmPlayer = document.getElementById("bgm-player");

// --------------------------
// PAGE INITIALIZATION
// --------------------------
document.addEventListener("DOMContentLoaded", () => {
    // Only run story systems if story elements are present
    if (document.getElementById("story-container")) {
        initStoryEngine();
    }
});

// Prevent context menu (Immersive Cinematic Mode)
document.addEventListener("contextmenu", (event) => {
    event.preventDefault();
});

// Fade in body on load
window.addEventListener("load", () => {
    document.body.style.opacity = "1";
});

// ==========================
// STORY ENGINE INITIALIZATION
// ==========================
async function initStoryEngine() {
    try {
        // 1. Read Chapter and Scene state from namespaced storage
        currentChapter = localStorage.getItem("yumei_game_currentChapter") || "chapter1";
        currentScene = parseInt(localStorage.getItem("yumei_game_currentScene")) || 0;

        // 2. Fetch Story Database
        const response = await fetch("./story.json");
        const data = await response.json();
        storyData = data[currentChapter];

        if (!storyData) {
            storyText.textContent = "Chapter content not found.";
            return;
        }

        // 3. Setup Audio Player
        initAudioEngine();

        // 4. Update Closeness Display
        updateHeartDisplay();

        // 5. Setup Input propagation click block
        const submitInputBtn = document.getElementById("submit-input");
        if (submitInputBtn) {
            submitInputBtn.addEventListener("click", (e) => {
                e.stopPropagation(); // CRITICAL BUG FIX: Stop click bubbling to document click handler
            });
        }
        const dynamicInputEl = document.getElementById("dynamic-input");
        if (dynamicInputEl) {
            dynamicInputEl.addEventListener("click", (e) => {
                e.stopPropagation(); // Avoid triggering next scene by clicking input field
            });
        }

        // 6. Draw Scene
        showScene();

    } catch (error) {
        console.error("Failed to load story database", error);
        storyText.textContent = "Error loading story. Please try refreshing.";
    }
}

// ==========================
// SCENE RENDERER
// ==========================
function showScene() {
    // End skip/auto-play modes if we reach the end of the chapter
    if (currentScene >= storyData.length) {
        handleChapterEnd();
        return;
    }

    const scene = storyData[currentScene];
    const username = localStorage.getItem("yumei_game_username") || "Player";

    // Unlocked assets verification for Gallery
    checkGalleryUnlocks(scene);

    // 1. Image Fade Animation
    if (sceneImage && sceneImage.src !== scene.image) {
        sceneImage.style.opacity = "0.2";
        setTimeout(() => {
            sceneImage.src = scene.image;
            sceneImage.style.opacity = "1";
        }, 150);
    }

    // 2. Speaker details
    if (speakerName) {
        if (scene.speaker === "") {
            speakerName.style.display = "none";
        } else {
            speakerName.style.display = "block";
            speakerName.textContent = scene.speaker.replaceAll("{username}", username);
        }
    }

    // 3. Branching Choice System Check
    if (checkForBranchingChoices(scene)) {
        return; 
    }

    // 4. Input Dialog Box System Check
    if (checkForInputBox(scene)) {
        return;
    }

    // 5. Replace text parameters
    let finalText = scene.text.replaceAll("{username}", username);
    
    // Custom dynamic variable placeholders
    const replaceTokens = {
        "{UserBirthdate}": "yumei_game_UserBirthdate",
        "{userfavoritecolor}": "yumei_game_userfavoritecolor",
        "{user_hobbies}": "yumei_game_user_hobbies"
    };

    for (const [token, storageKey] of Object.entries(replaceTokens)) {
        const value = localStorage.getItem(storageKey) || "";
        finalText = finalText.replaceAll(token, value);
    }

    currentFullText = finalText;

    // 6. Push to dialogue history log (Backlog)
    const displaySpeaker = scene.speaker ? scene.speaker.replaceAll("{username}", username) : "Narrator";
    if (dialogueHistory.length === 0 || dialogueHistory[dialogueHistory.length - 1].text !== finalText) {
        dialogueHistory.push({ speaker: displaySpeaker, text: finalText });
    }

    // 7. Render text with typewriter effect
    startTypewriter(finalText);
}

// ==========================
// TYPEWRITER EFFECT
// ==========================
function startTypewriter(text) {
    if (typingTimeout) clearTimeout(typingTimeout);
    
    isTyping = true;
    storyText.textContent = "";
    let i = 0;
    const speed = isSkipMode ? 2 : 25; // Speed typing up if skip mode is on

    function typeChar() {
        if (i < text.length) {
            storyText.textContent += text.charAt(i);
            i++;
            typingTimeout = setTimeout(typeChar, speed);
        } else {
            isTyping = false;
            if (continueIndicator) continueIndicator.style.opacity = "1";

            // Trigger autoplay sequence if turned on
            if (isAutoPlay && !waitingForInput && !waitingForChoice) {
                autoPlayTimeout = setTimeout(nextScene, 2500);
            }
        }
    }

    typeChar();
}

function completeTypewriter() {
    if (typingTimeout) clearTimeout(typingTimeout);
    storyText.textContent = currentFullText;
    isTyping = false;
    if (continueIndicator) continueIndicator.style.opacity = "1";

    if (isAutoPlay && !waitingForInput && !waitingForChoice) {
        autoPlayTimeout = setTimeout(nextScene, 2500);
    }
}

// ==========================
// BRANCHING CHOICES SYSTEM
// ==========================
const DECISION_POINTS = {
    chapter1: {
        // Near Yumei introducing herself
        103: {
            question: "How do you respond to Yumei saying \"...you first\"?",
            options: [
                { text: "Say: \"Ladies first, you know?\"", score: 0, feedback: "You insisted politely on lady's privilege." },
                { text: "Introduce yourself first with a warm smile", score: 1, feedback: "Yumei blinks, appreciating your warm openness." }
            ]
        },
        // Deciding to teach web development
        337: {
            question: "Will you teach Yumei how to make websites?",
            options: [
                { text: "Invite her: \"I will help you. We can make them together!\"", score: 1, feedback: "Yumei looks at you with surprised happiness." },
                { text: "Caution her: \"It takes a lot of study. It might be hard.\"", score: -1, feedback: "Yumei nods slowly, looking slightly discouraged." }
            ]
        }
    },
    chapter2: {
        // Library conversation choice
        543: {
            question: "Which of your projects will you show Yumei first?",
            options: [
                { text: "Show her LexiVerse (English Learning App)", score: 1, feedback: "Yumei leans closer, fascinated by the words." },
                { text: "Show her React Calculator", score: 0, feedback: "Yumei nods politely, inspecting the calculations." }
            ]
        }
    },
    chapter3: {
        // Exam nervousness
        2112: {
            question: "Yumei is nervous about biology exams. What do you tell her?",
            options: [
                { text: "Comfort her: \"Whenever a problem comes, either accept it or solve it.\"", score: 1, feedback: "Yumei listens closely, finding strength in your logic." },
                { text: "Tease her: \"Looks like the school topper has a weakness!\"", score: -1, feedback: "Yumei puffs her cheeks and frowns in annoyance." }
            ]
        },
        // Favorite color question
        3600: {
            question: "Yumei asks for your favorite color.",
            options: [
                { text: "Tell her honestly & ask her favorite color in return", score: 1, feedback: "She smiles softly, sharing her love for dark blue." },
                { text: "Tease: \"You'll only know if you guess correctly!\"", score: 0, feedback: "She rolls her eyes playfully, demanding an answer." }
            ]
        }
    }
};

function checkForBranchingChoices(scene) {
    const points = DECISION_POINTS[currentChapter];
    if (!points || !points[currentScene]) return false;

    // Trigger choices
    waitingForChoice = true;
    isSkipMode = false; // Turn off skip on decisions
    isAutoPlay = false; // Turn off auto on decisions
    updateControlBarUI();

    const decision = points[currentScene];
    storyText.textContent = decision.question;
    if (speakerName) {
        speakerName.textContent = "Decide Your Response";
        speakerName.style.display = "block";
    }

    if (continueIndicator) continueIndicator.style.display = "none";
    
    // Render choice buttons
    if (choiceContainer) {
        choiceContainer.innerHTML = "";
        choiceContainer.style.display = "flex";
        
        decision.options.forEach((opt, idx) => {
            const btn = document.createElement("button");
            btn.className = "choice-btn";
            btn.textContent = opt.text;
            btn.onclick = (e) => {
                e.stopPropagation();
                handleChoiceSelection(opt);
            };
            choiceContainer.appendChild(btn);
        });
    }

    return true;
}

function handleChoiceSelection(option) {
    waitingForChoice = false;
    if (choiceContainer) choiceContainer.style.display = "none";
    if (continueIndicator) continueIndicator.style.display = "inline";

    // 1. Calculate and update relationship points
    let currentScore = parseInt(localStorage.getItem("yumei_game_relationship_score")) || 3;
    currentScore = Math.max(1, Math.min(5, currentScore + option.score));
    localStorage.setItem("yumei_game_relationship_score", currentScore);
    updateHeartDisplay();

    // 2. Play subtle selection SFX
    playSFX("click");

    // 3. Overwrite narrative feedback temporarily
    if (speakerName) speakerName.textContent = "";
    storyText.textContent = option.feedback;
    currentFullText = option.feedback;
    
    // We increment scene index to move past choice trigger point next tap
    currentScene++;
    localStorage.setItem("yumei_game_currentScene", currentScene);
}

// ==========================
// INPUT CONTROLLERS
// ==========================
function checkForInputBox(scene) {
    const variableMap = {
        "{UserBirthdate}": {
            storage: "yumei_game_UserBirthdate",
            placeholder: "Enter your birthdate (e.g. Oct 24)"
        },
        "{userfavoritecolor}": {
            storage: "yumei_game_userfavoritecolor",
            placeholder: "Enter your favorite color"
        },
        "{user_hobbies}": {
            storage: "yumei_game_user_hobbies",
            placeholder: "Enter your hobbies"
        }
    };

    const trimmedText = scene.text.trim();
    if (variableMap[trimmedText]) {
        const config = variableMap[trimmedText];
        const savedValue = localStorage.getItem(config.storage);

        if (!savedValue) {
            triggerInputForm(config.storage, config.placeholder);
            return true;
        }
    }
    return false;
}

function triggerInputForm(key, placeholder) {
    waitingForInput = true;
    isSkipMode = false;
    isAutoPlay = false;
    updateControlBarUI();

    const inputBox = document.getElementById("user-input-box");
    const inputField = document.getElementById("dynamic-input");
    const submitBtn = document.getElementById("submit-input");

    if (inputBox && inputField) {
        inputBox.style.display = "flex";
        inputField.placeholder = placeholder;
        inputField.value = "";
        inputField.focus();
    }

    if (continueIndicator) continueIndicator.style.display = "none";

    function submitInput() {
        const val = inputField.value.trim();
        if (!val) return; // Verify value exists

        localStorage.setItem(key, val);
        
        if (inputBox) inputBox.style.display = "none";
        if (continueIndicator) continueIndicator.style.display = "inline";

        waitingForInput = false;
        updateControlBarUI();

        showScene();
    }

    if (submitBtn) {
        submitBtn.onclick = submitInput;
    }

    if (inputField) {
        inputField.onkeydown = (event) => {
            event.stopPropagation();
            if (event.key === "Enter") {
                submitInput();
            }
        };
    }
}

// ==========================
// VISUAL NOVEL ACTIONS (AUTO, SKIP, LOG)
// ==========================
function nextScene() {
    if (waitingForInput || waitingForChoice) return;

    if (isTyping) {
        completeTypewriter();
        return;
    }

    if (autoPlayTimeout) clearTimeout(autoPlayTimeout);

    currentScene++;
    localStorage.setItem("yumei_game_currentScene", currentScene);
    showScene();
}

// Global click event to advance dialogue
document.addEventListener("click", (e) => {
    // Avoid advancing if player clicks control buttons or choice keys
    const isControlClick = e.target.closest("#story-controls") || 
                           e.target.closest("#user-input-box") || 
                           e.target.closest("#choice-container") || 
                           e.target.closest(".modal-overlay");
    if (isControlClick) return;

    nextScene();
});

// Keyboard hotkeys
document.addEventListener("keydown", (event) => {
    if (waitingForInput || waitingForChoice) return;

    if (event.key === " " || event.key === "Enter" || event.key === "ArrowRight") {
        nextScene();
    }
});

// Auto-Play Toggle
function toggleAuto(event) {
    if (event) event.stopPropagation();
    
    isAutoPlay = !isAutoPlay;
    isSkipMode = false; // Mutual exclusion
    
    if (isAutoPlay) {
        if (!isTyping) {
            autoPlayTimeout = setTimeout(nextScene, 2000);
        }
    } else {
        if (autoPlayTimeout) clearTimeout(autoPlayTimeout);
    }
    
    updateControlBarUI();
}

// Skip Mode Toggle
function toggleSkip(event) {
    if (event) event.stopPropagation();

    isSkipMode = !isSkipMode;
    isAutoPlay = false; // Mutual exclusion

    if (isSkipMode) {
        skipInterval = setInterval(() => {
            if (!waitingForInput && !waitingForChoice) {
                nextScene();
            } else {
                toggleSkip(); // Stop skipping if input or choice pops up
            }
        }, 350);
    } else {
        if (skipInterval) clearInterval(skipInterval);
    }

    updateControlBarUI();
}

// History backlog screen modal
function openBacklog(event) {
    if (event) event.stopPropagation();
    
    const modal = document.getElementById("backlog-modal");
    const list = document.getElementById("backlog-list");
    
    if (modal && list) {
        list.innerHTML = "";
        dialogueHistory.forEach(item => {
            const entry = document.createElement("div");
            entry.className = "backlog-entry";
            entry.innerHTML = `
                <strong class="backlog-speaker ${item.speaker === "Yumei" ? "yumei" : "player"}">${item.speaker}:</strong>
                <span class="backlog-text">${item.text}</span>
            `;
            list.appendChild(entry);
        });
        modal.style.display = "flex";
    }
}

function closeBacklog() {
    const modal = document.getElementById("backlog-modal");
    if (modal) modal.style.display = "none";
}

// ==========================
// AUDIO ENGINE (BGM & SFX)
// ==========================
function initAudioEngine() {
    if (!bgmPlayer) return;

    // Load track according to chapter config
    const targetTrack = BGM_TRACKS[currentChapter] || "assets/audio/track1.mp3";
    bgmPlayer.src = targetTrack;

    // Load sound settings
    const savedVolume = localStorage.getItem("yumei_game_volume");
    const slider = document.getElementById("volume-slider");
    if (savedVolume !== null) {
        bgmPlayer.volume = parseFloat(savedVolume);
        if (slider) slider.value = Math.round(parseFloat(savedVolume) * 100);
    } else {
        bgmPlayer.volume = 0.5;
    }

    const isMuted = localStorage.getItem("yumei_game_muted") === "true";
    bgmPlayer.muted = isMuted;

    // Start background music loop upon initial user gesture (browser requirements)
    const playOnInteract = () => {
        bgmPlayer.play().catch(() => {});
        document.removeEventListener("click", playOnInteract);
    };
    document.addEventListener("click", playOnInteract);

    updateControlBarUI();
}

function toggleMusic(event) {
    if (event) event.stopPropagation();
    if (!bgmPlayer) return;

    bgmPlayer.muted = !bgmPlayer.muted;
    localStorage.setItem("yumei_game_muted", bgmPlayer.muted);
    updateControlBarUI();

    if (!bgmPlayer.muted && bgmPlayer.paused) {
        bgmPlayer.play().catch(() => {});
    }
}

function adjustVolume(event) {
    if (event) event.stopPropagation();
    if (!bgmPlayer) return;

    const val = event.target.value / 100;
    bgmPlayer.volume = val;
    localStorage.setItem("yumei_game_volume", val.toString());
}

function playSFX(type) {
    // SFX Engine using Web Audio API synthesis for zero dependencies
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        if (type === "click") {
            osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.12);
        }
    } catch (e) {
        console.warn("SFX synthesis failed", e);
    }
}

// ==========================
// RELATIONSHIP RATING (HEARTS)
// ==========================
function updateHeartDisplay() {
    if (!heartsDisplay) return;

    const rating = parseInt(localStorage.getItem("yumei_game_relationship_score")) || 3;
    let heartStr = "";
    
    // Hidden heart display representation
    for (let i = 0; i < rating; i++) {
        heartStr += "♥ ";
    }
    
    heartsDisplay.textContent = heartStr.trim();
}

// ==========================
// CORE GALLERY TRACKING
// ==========================
function checkGalleryUnlocks(scene) {
    // Unlocks backgrounds and memories as the player views them
    if (scene.image.includes("chapter1/scene1")) {
        localStorage.setItem("yumei_game_unlocked_bg_classroom", "true");
        localStorage.setItem("yumei_game_unlocked_cg_first_meeting", "true");
    }
    if (scene.image.includes("chapter1/scene2")) {
        localStorage.setItem("yumei_game_unlocked_bg_hallway", "true");
    }
    if (scene.image.includes("chapter1/scene4")) {
        localStorage.setItem("yumei_game_unlocked_bg_gate", "true");
    }
    if (scene.image.includes("chapter2/scene1")) {
        localStorage.setItem("yumei_game_unlocked_bg_library", "true");
    }
    if (scene.image.includes("chapter3/scene11")) {
        const score = parseInt(localStorage.getItem("yumei_game_relationship_score")) || 3;
        if (score >= 4) {
            localStorage.setItem("yumei_game_unlocked_cg_confession", "true");
        }
    }
    if (scene.image.includes("chapter3/scene15")) {
        localStorage.setItem("yumei_game_unlocked_cg_sunset_walk", "true");
    }

    // Music tracks unlock as chapters start
    if (currentChapter === "chapter1") {
        localStorage.setItem("yumei_game_unlocked_music_track1", "true");
    }
    if (currentChapter === "chapter2") {
        localStorage.setItem("yumei_game_unlocked_music_track2", "true");
    }
}

// ==========================
// CHAPTER COMPLETION HANDLER
// ==========================
function handleChapterEnd() {
    if (typingTimeout) clearTimeout(typingTimeout);
    if (autoPlayTimeout) clearTimeout(autoPlayTimeout);
    if (skipInterval) clearInterval(skipInterval);

    localStorage.setItem("yumei_game_completedChapter", currentChapter);

    const nextChapter = chapterOrder[currentChapter];
    if (nextChapter && nextChapter !== "chapter4") {
        localStorage.setItem("yumei_game_nextChapter", nextChapter);
    }

    localStorage.setItem("yumei_game_currentScene", "0");

    // Clear active playback loops
    isAutoPlay = false;
    isSkipMode = false;

    // Route to completion screen
    window.location.href = "outro.html";
}

// ==========================
// UI CONTROL UTILITIES
// ==========================
function updateControlBarUI() {
    const autoBtn = document.getElementById("auto-btn");
    const skipBtn = document.getElementById("skip-btn");
    const musicBtn = document.getElementById("music-toggle-btn");

    if (autoBtn) {
        if (isAutoPlay) {
            autoBtn.classList.add("active-control");
            autoBtn.textContent = "Auto [ON]";
        } else {
            autoBtn.classList.remove("active-control");
            autoBtn.textContent = "Auto";
        }
    }

    if (skipBtn) {
        if (isSkipMode) {
            skipBtn.classList.add("active-control");
            skipBtn.textContent = "Skip [ON]";
        } else {
            skipBtn.classList.remove("active-control");
            skipBtn.textContent = "Skip";
        }
    }

    if (musicBtn && bgmPlayer) {
        musicBtn.textContent = bgmPlayer.muted ? "🎵 Mute" : "🎵 Play";
    }
}