// ==========================
// DATEYUMEI SCRIPT
// ==========================

// --------------------------
// STORY CONFIG
// --------------------------

const chapterOrder = {

    chapter1: "chapter2",
    chapter2: "chapter3",
    chapter3: "chapter4",
    chapter4: "chapter5"
};

// ==========================
// MENU FUNCTIONS
// ==========================

function startStory() {

    const username =
        document
        .getElementById(
            "username-input"
        )
        ?.value
        .trim();

    if (!username) {

        alert(
            "Please enter your name"
        );

        return;
    }

    // Keep custom inputs
    const savedBirthdate =
        localStorage.getItem(
            "UserBirthdate"
        );

    const savedColor =
        localStorage.getItem(
            "userfavoritecolor"
        );

    const savedHobbies =
        localStorage.getItem(
            "user_hobbies"
        );

    // Reset story
    localStorage.clear();

    // Restore custom values
    if (savedBirthdate) {

        localStorage.setItem(
            "UserBirthdate",
            savedBirthdate
        );
    }

    if (savedColor) {

        localStorage.setItem(
            "userfavoritecolor",
            savedColor
        );
    }

    if (savedHobbies) {

        localStorage.setItem(
            "user_hobbies",
            savedHobbies
        );
    }

    // Save username
    localStorage.setItem(
        "username",
        username
    );

    // Start from chapter1
    localStorage.setItem(
        "currentChapter",
        "chapter1"
    );

    localStorage.setItem(
        "currentScene",
        "0"
    );

    window.location.href =
        "story.html";
}

function continueStory() {

    if (

        !localStorage.getItem(
            "currentChapter"
        )

    ) {

        localStorage.setItem(
            "currentChapter",
            "chapter1"
        );

        localStorage.setItem(
            "currentScene",
            "0"
        );
    }

    window.location.href =
        "story.html";
}

// ==========================
// CINEMATIC TOUCHES
// ==========================

document.addEventListener(
    "contextmenu",
    (event) => {

        event.preventDefault();
    }
);

window.addEventListener(
    "load",
    () => {

        document.body.style.opacity =
            "1";
    }
);

// ==========================
// STORY SYSTEM
// ==========================

let storyData = [];
let currentScene = 0;
let currentChapter = "";
let waitingForInput = false;

// DOM
const sceneImage =
    document.getElementById(
        "scene-image"
    );

const speakerName =
    document.getElementById(
        "speaker-name"
    );

const storyText =
    document.getElementById(
        "story-text"
    );

// Only story page
if (

    window.location.pathname
    .includes("story.html")

) {

    loadStory();
}

// ==========================
// LOAD STORY
// ==========================

async function loadStory() {

    try {

        const response =
            await fetch(
                "./story.json"
            );

        const data =
            await response.json();

        currentChapter =

            localStorage.getItem(
                "currentChapter"
            )

            || "chapter1";

        storyData =
            data[currentChapter];

        if (!storyData) {

            storyText.textContent =
                "Chapter not found.";

            return;
        }

        currentScene =
            parseInt(

                localStorage.getItem(
                    "currentScene"
                )

            ) || 0;

        showScene();

    }

    catch (error) {

        console.error(error);

        storyText.textContent =
            "Failed to load story.";
    }
}

// ==========================
// SHOW SCENE
// ==========================

function showScene() {

    const scene =
        storyData[currentScene];

    // Chapter End
    if (!scene) {

        localStorage.setItem(
            "completedChapter",
            currentChapter
        );

        const nextChapter =

            chapterOrder[
                currentChapter
            ];

        if (nextChapter) {

            localStorage.setItem(
                "nextChapter",
                nextChapter
            );
        }

        localStorage.setItem(
            "currentScene",
            "0"
        );

        window.location.href =
            "outro.html";

        return;
    }

    const username =

        localStorage.getItem(
            "username"
        )

        || "Player";

    // Image
    if (
        sceneImage
    ) {

        sceneImage.src =
            scene.image;
    }

    // Speaker
    if (
        scene.speaker === ""
    ) {

        speakerName.style.display =
            "none";
    }

    else {

        speakerName.style.display =
            "block";

        speakerName.textContent =

            scene.speaker.replaceAll(
                "{username}",
                username
            );
    }

    // ==========================
    // STORY TEXT + INPUT SYSTEM
    // ==========================

    let finalText =

        scene.text.replaceAll(
            "{username}",
            username
        );

    const variableMap = {

        "{UserBirthdate}": {

            storage:
            "UserBirthdate",

            placeholder:
            "Enter your birthdate"
        },

        "{userfavoritecolor}": {

            storage:
            "userfavoritecolor",

            placeholder:
            "Enter your favorite color"
        },

        "{user_hobbies}": {

            storage:
            "user_hobbies",

            placeholder:
            "Enter your hobbies"
        }
    };

    const trimmedText =
        finalText.trim();

    // Exact input scene
    if (

        variableMap[
            trimmedText
        ]

    ) {

        const config =

            variableMap[
                trimmedText
            ];

        const savedValue =

            localStorage.getItem(
                config.storage
            );

        if (!savedValue) {

            askForInput(

                config.storage,

                config.placeholder
            );

            return;
        }

        finalText =
            savedValue;
    }

    // Replace inside sentence
    for (

        const token
        in variableMap

    ) {

        const config =
            variableMap[token];

        const savedValue =

            localStorage.getItem(
                config.storage
            ) || "";

        finalText =
            finalText.replaceAll(
                token,
                savedValue
            );
    }

    storyText.textContent =
        finalText;
}

// ==========================
// NEXT SCENE
// ==========================

function nextScene() {

    if (
        waitingForInput
    ) return;

    if (
        storyData.length === 0
    ) return;

    currentScene++;

    localStorage.setItem(
        "currentScene",
        currentScene
    );

    showScene();
}

// ==========================
// CONTROLS
// ==========================

document.addEventListener(
    "click",
    () => {

        if (

            window.location.pathname
            .includes("story.html")

        ) {

            nextScene();
        }
    }
);

document.addEventListener(
    "keydown",
    (event) => {

        if (
            waitingForInput
        ) return;

        if (

            event.key === " " ||

            event.key ===
            "Enter" ||

            event.key ===
            "ArrowRight"

        ) {

            nextScene();
        }
    }
);

// ==========================
// INPUT SYSTEM
// ==========================

function askForInput(
    key,
    placeholder
) {

    if (
        waitingForInput
    ) return;

    waitingForInput =
        true;

    const inputBox =
        document.getElementById(
            "user-input-box"
        );

    const input =
        document.getElementById(
            "dynamic-input"
        );

    const submit =
        document.getElementById(
            "submit-input"
        );

    const continueIndicator =
        document.getElementById(
            "continue-indicator"
        );

    inputBox.style.display =
        "flex";

    input.placeholder =
        placeholder;

    input.value = "";

    input.focus();

    continueIndicator
    .style.display =
        "none";

    function submitInput() {

        const value =
            input.value.trim();

        if (!value)
            return;

        localStorage.setItem(
            key,
            value
        );

        inputBox.style.display =
            "none";

        continueIndicator
        .style.display =
            "inline";

        waitingForInput =
            false;

        showScene();
    }

    submit.onclick =
        submitInput;

    input.onkeydown =
        (event) => {

            event.stopPropagation();

            if (
                event.key ===
                "Enter"
            ) {

                submitInput();
            }
        };
}