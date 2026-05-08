// ─── Constants ───────────────────────────────────────────────────────────────

const TOTAL_QUESTIONS = 8;
const MIXED_TOTAL_QUESTIONS = 12;
const MIXED_TECHNICAL_QUESTIONS = 5;
const QUESTION_TIME_LIMIT = 90;

const FACE_API_MODEL_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights";

const WARNING_COOLDOWN_MS = 3000;
const MAX_CHEATING_COUNT = 3;
const MAX_MULTI_FACE_COUNT = 3;
const NO_EYE_CONTACT_THRESHOLD = 20;


// ─── Firebase ────────────────────────────────────────────────────────────────

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAETyqOQAUdpUWjAkbtEJI_QFXf4nrGoos",
    authDomain: "mockmate-ai-dc73f.firebaseapp.com",
    projectId: "mockmate-ai-dc73f",
    storageBucket: "mockmate-ai-dc73f.firebasestorage.app",
    messagingSenderId: "493275586457",
    appId: "1:493275586457:web:839dd3a7bdd2eb8cab7d08"
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);


// ─── State ───────────────────────────────────────────────────────────────────

const state = {
    role:                      "",
    mode:                      "mixed",
    resumeFileName:            "",
    resumeNotes:               "",
    resumeText:                "",
    prepPlan:                  null,
    questionIndex:             0,
    currentQuestion:           null,
    questionStartedAt:         null,
    secondsLeft:               QUESTION_TIME_LIMIT,
    countdownId:               null,
    recognition:               null,
    dictationManualStop:       false,
    dictationRestartTimer:     null,
    dictationSilenceTimer:     null,
    dictationFinalTranscript:  "",
    waveformAudioContext:      null,
    waveformAnalyser:          null,
    waveformSource:            null,
    waveformStream:            null,
    waveformAnimationId:       null,
    answers:                   [],
    interviewStartedAt:        null,
    completed:                 false,
    faceModelsLoaded:          false,
    eyeContactFrames:          0,
    noEyeContactFrames:        0,
    totalFrames:               0,
    eyeDetectionIntervalId:    null,
    webcamStream:              null,
    followUpUsed:              false,
    question3NeedsFollowUp:    null,
    questionNarrationEnabled:  false,
    questionNarration:         null,
    narrationPauseTimer:       null,
    narrationHighlightTimer:   null,
    narratedWordSpans:         [],
    isJokeTurn:                false,
    // FIX #3: removed duplicate cheatingCount — use only state.cheatingCount everywhere
    cheatingCount:             0,
    multipleFaceCount:         0,
    lastWarningTime:           0,
    lastTabSwitchTime:         0,
    tabSwitchAlertPending:     false,
    ignoreFocusLossUntil:      0,
};

const dom = {};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Boot ────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
    cacheDom();
    bindEvents();
    initializeQuestionNarrationPreference();
    syncPrepModeSelection();
    syncInterviewModeSelection();
    // Start interview-only anti-cheat listeners. They stay idle until a session begins.
    registerCopyPasteGuard();
    registerPasteCleanupGuard();
    // FIX #4: registerVisibilityGuard was called but never defined.
    // The visibility listener is now registered directly here instead.
    registerVisibilityGuard();

    updateBriefStatus("Waiting to begin");
    setStatus("Ready to begin");
    startMultiFaceGuard();
});

// ─── DOM cache ───────────────────────────────────────────────────────────────

function cacheDom() {
    dom.resetSessionBtn        = document.getElementById("resetSessionBtn");
    dom.setupPhase             = document.getElementById("setupPhase");
    dom.interviewPhase         = document.getElementById("interviewPhase");
    dom.prepPhase              = document.getElementById("prepPhase");
    dom.jobRole                = document.getElementById("jobRole");
    dom.fileUpload             = document.getElementById("fileUpload");
    dom.uploadTrigger          = document.getElementById("uploadTrigger");
    dom.uploadLabel            = document.getElementById("uploadLabel");
    dom.uploadHint             = document.getElementById("uploadHint");
    dom.resumeNotes            = document.getElementById("resumeNotes");
    dom.startInterviewBtn      = document.getElementById("startInterviewBtn");
    dom.prepStartLiveBtn       = document.getElementById("prepStartLiveBtn");
    dom.prepSummary            = document.getElementById("prepSummary");
    dom.prepUserName           = document.getElementById("prepUserName");
    dom.prepUserRole           = document.getElementById("prepUserRole");
    dom.prepSkillList          = document.getElementById("prepSkillList");
    dom.prepAiSummary          = document.getElementById("prepAiSummary");
    dom.prepFocusGrid          = document.getElementById("prepFocusGrid");
    dom.prepTopicList          = document.getElementById("prepTopicList");
    dom.prepTipList            = document.getElementById("prepTipList");
    dom.questionProgress       = document.getElementById("questionProgress");
    dom.questionSequenceLabel  = document.getElementById("questionSequenceLabel");
    dom.countdownTimer         = document.getElementById("countdownTimer");
    dom.interviewerBubble      = document.getElementById("interviewerBubble");
    dom.interviewerBubbleText  = document.getElementById("interviewerBubbleText");
    dom.questionCard           = document.getElementById("questionCard");
    dom.questionBlock          = document.getElementById("questionBlock");
    dom.contextRow             = document.getElementById("contextRow");
    dom.questionContext        = document.getElementById("questionContext");
    dom.questionText           = document.getElementById("questionText");
    dom.questionNarrationToggle = document.getElementById("questionNarrationToggle");
    dom.questionNarrationLabel = document.getElementById("questionNarrationLabel");
    dom.followUpRow            = document.getElementById("followUpRow");
    dom.questionFollowUp       = document.getElementById("questionFollowUp");
    dom.micBtn                 = document.getElementById("micBtn");
    dom.waveform               = document.getElementById("waveform");
    dom.statusText             = document.getElementById("statusText");
    dom.answerInput            = document.getElementById("answerInput");
    dom.submitAnswerBtn        = document.getElementById("submitAnswerBtn");
    dom.skipQuestionBtn        = document.getElementById("skipQuestionBtn");
    dom.endInterviewBtn        = document.getElementById("endInterviewBtn");
    dom.briefRole              = document.getElementById("briefRole");
    dom.briefResume            = document.getElementById("briefResume");
    dom.briefStatus            = document.getElementById("briefStatus");
    dom.prepModes              = document.querySelectorAll('input[name="prepMode"]');
    dom.interviewModes         = document.querySelectorAll('input[name="interviewMode"]');
    dom.interviewModePanel     = document.getElementById("interviewModePanel");
    dom.selfViewVideo          = document.getElementById("selfViewVideo");
    dom.cameraIndicator        = document.getElementById("cameraIndicator");
    dom.cameraIndicatorText    = document.getElementById("cameraIndicatorText");
    dom.warningBox             = document.getElementById("warningBox");
}

// ─── Events ──────────────────────────────────────────────────────────────────

function bindEvents() {
    dom.uploadTrigger.addEventListener("click", () => dom.fileUpload.click());
    dom.fileUpload.addEventListener("change", handleFileChange);
    dom.startInterviewBtn.addEventListener("click", startInterview);
    dom.prepStartLiveBtn?.addEventListener("click", startLiveFromPrep);
    dom.questionNarrationToggle?.addEventListener("change", handleQuestionNarrationToggle);
    dom.micBtn.addEventListener("click", toggleDictation);
    dom.answerInput.addEventListener("keydown", handleAnswerInputKeydown);
    dom.submitAnswerBtn.addEventListener("click", submitAnswer);
    dom.skipQuestionBtn.addEventListener("click", skipQuestion);
    dom.endInterviewBtn.addEventListener("click", () => endInterview());
    dom.resetSessionBtn.addEventListener("click", () => window.location.reload());
    dom.prepModes.forEach((input) => input.addEventListener("change", syncPrepModeSelection));
    dom.interviewModes.forEach((input) => input.addEventListener("change", syncInterviewModeSelection));
}

// ─── Anti-cheat: tab/window switching ────────────────────────────────────────

// FIX #3 & #4: Removed the duplicate top-level `cheatingCount` variable and the
// orphaned inline visibilitychange listener. All cheating tracking now goes through
// state.cheatingCount. registerVisibilityGuard is a proper named function so the
// boot sequence can call it without a ReferenceError.

function registerVisibilityGuard() {
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) return;
        if (!isInterviewActive()) return;

        // FIX #5: honour ignoreFocusLossUntil so copy-paste alert dismissals
        // don't double-fire the visibility warning.
        if (Date.now() < state.ignoreFocusLossUntil) return;

        state.cheatingCount += 1;
        showWarning("Tab switch detected! Please stay on the interview screen.");

        if (state.cheatingCount >= MAX_CHEATING_COUNT) {
            alert("Interview terminated due to suspicious activity.");
            window.location.href = "/index.html";
            return;
        }

        alert(`Cheating detected! Please stay on the interview screen. (Warning ${state.cheatingCount}/${MAX_CHEATING_COUNT})`);
    });
}


// ─── Anti-cheat: Copy/Paste Guard ─────────────────────────────────────────────

function registerCopyPasteGuard() {
    // Blocks clipboard actions and drag/drop only during the live interview.
    ["copy", "cut", "paste", "drop"].forEach((eventType) => {
        document.addEventListener(eventType, blockClipboardAction, true);
    });

    // Blocks right-click menu during the live interview so paste is not available there.
    document.addEventListener("contextmenu", blockClipboardAction, true);

    // Blocks common keyboard shortcuts for copy, paste, cut, select-all, and save.
    document.addEventListener("keydown", blockClipboardShortcuts, true);
}

function blockClipboardAction(event) {
    if (!isInterviewActive()) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    notifyCopyPasteBlocked();
}

function blockClipboardShortcuts(event) {
    if (!isInterviewActive() || !(event.ctrlKey || event.metaKey)) return;
    if (!["a", "c", "s", "v", "x"].includes(event.key.toLowerCase())) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    notifyCopyPasteBlocked();
}

function registerPasteCleanupGuard() {
    if (!dom.answerInput) return;
    dom.answerInput.addEventListener("input", (e) => {
        if (!isInterviewActive()) return;
        if (e.inputType === "insertFromPaste" || e.inputType === "insertFromPasteAsQuotation") {
            dom.answerInput.value = "";
            e.preventDefault();
            notifyCopyPasteBlocked();
        }
    });
}

function notifyCopyPasteBlocked() {
    const message = "copy-paste blocked to avoid cheating";
    showWarning(message);
    // FIX #9: Set ignoreFocusLossUntil ONCE after the alert returns, not twice.
    alert(message);
    state.ignoreFocusLossUntil = Date.now() + 1000;
}

function isInterviewActive() {
    return Boolean(state.interviewStartedAt && !state.completed);
}

// ─── Anti-cheat: multi-face guard ────────────────────────────────────────────

function startMultiFaceGuard() {
    setInterval(async () => {
        if (
            state.completed ||
            !state.faceModelsLoaded ||
            !dom.selfViewVideo ||
            dom.selfViewVideo.readyState < 2
        ) return;

        try {
            const detections = await faceapi
                .detectAllFaces(dom.selfViewVideo, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks();

            if (detections.length > 1) {
                state.multipleFaceCount += 1;
                if (state.multipleFaceCount >= MAX_MULTI_FACE_COUNT) {
                    showWarning("Interview terminated due to multiple faces.");
                    setTimeout(() => { window.location.href = "/index.html"; }, 2000);
                    alert("Multiple faces detected. Interview terminated due to suspicious activity.");
                }
            } else {
                state.multipleFaceCount = Math.max(0, state.multipleFaceCount - 1);
            }
        } catch {
            // silent
        }
    }, 1000);
}

// ─── Warning helper ──────────────────────────────────────────────────────────

function showWarning(message) {
    const now = Date.now();
    if (now - state.lastWarningTime < WARNING_COOLDOWN_MS) return;
    state.lastWarningTime = now;

    if (!dom.warningBox) return;
    dom.warningBox.innerText = message;
    dom.warningBox.classList.remove("hidden");
    setTimeout(() => dom.warningBox.classList.add("hidden"), 3000);
}

// ─── File handling ───────────────────────────────────────────────────────────

function initializeQuestionNarrationPreference() {
    state.questionNarrationEnabled = localStorage.getItem("mockmateNarrationEnabled") === "true";
    if (dom.questionNarrationToggle) {
        dom.questionNarrationToggle.checked = state.questionNarrationEnabled;
    }
    updateQuestionNarrationLabel();
}

async function handleFileChange() {
    const file = dom.fileUpload.files?.[0];
    if (!file) return;

    state.resumeFileName = file.name;
    dom.uploadTrigger.classList.add("is-ready");
    dom.uploadLabel.textContent = file.name;
    dom.uploadHint.textContent = "Reading resume...";

    state.resumeText = await extractResumeText(file);
    dom.uploadHint.textContent = state.resumeText
        ? "Resume attached and analyzed"
        : "Resume attached successfully";
}

// ─── Interview setup ─────────────────────────────────────────────────────────

async function startInterview() {
    const role = dom.jobRole.value.trim();
    const file = dom.fileUpload.files?.[0];

    if (!role) { alert("Please select a job role before continuing."); return; }
    if (!file) { alert("Please upload your resume before starting the interview."); return; }

    // FIX #10: Wait for resume extraction to finish before proceeding, in case
    // the user clicks the button before handleFileChange has resolved.
    if (!state.resumeText && file) {
        dom.startInterviewBtn.disabled    = true;
        dom.startInterviewBtn.textContent = "Reading resume...";
        state.resumeText = await extractResumeText(file);
        dom.startInterviewBtn.disabled    = false;
        dom.startInterviewBtn.textContent = getSelectedPrepMode() === "prep"
            ? "Create Prep Plan"
            : "Continue to Interview";
    }

    state.role             = role;
    state.mode             = getSelectedInterviewMode();
    state.resumeNotes      = state.resumeText || dom.resumeNotes?.value.trim() || "";
    state.resumeFileName   = file.name;
    state.answers          = [];
    state.questionIndex    = 0;
    state.completed        = false;
    state.interviewStartedAt = Date.now();
    state.eyeContactFrames   = 0;
    state.noEyeContactFrames = 0;
    state.totalFrames        = 0;
    resetFollowUpState();

    if (getSelectedPrepMode() === "prep") {
        await showPrepDashboard();
        return;
    }

    await beginLiveInterview();
}

async function beginLiveInterview() {
    dom.setupPhase.classList.add("hidden");
    dom.prepPhase?.classList.add("hidden");
    dom.interviewPhase.classList.remove("hidden");
    dom.briefRole.textContent   = state.role;
    dom.briefResume.textContent = state.resumeFileName;
    updateBriefStatus("Generating first question");
    setStatus("Processing...");

    dom.answerInput.value = "";
    await initCameraAndEyeTracking();
    await loadNextQuestion();
}

async function startLiveFromPrep() {
    const file             = dom.fileUpload.files?.[0];
    state.mode             = getSelectedInterviewMode();
    state.answers          = [];
    state.questionIndex    = 0;
    state.completed        = false;
    state.interviewStartedAt = Date.now();
    state.eyeContactFrames   = 0;
    state.noEyeContactFrames = 0;
    state.totalFrames        = 0;
    resetFollowUpState();
    state.role             = dom.jobRole.value.trim();
    state.resumeFileName   = file?.name || state.resumeFileName;
    state.resumeNotes      = state.resumeText || state.resumeNotes;
    await beginLiveInterview();
}

// ─── Prep dashboard ──────────────────────────────────────────────────────────

async function showPrepDashboard() {
    dom.startInterviewBtn.disabled    = true;
    dom.startInterviewBtn.textContent = "Building prep plan...";

    try {
        const plan   = await requestPrepPlan();
        state.prepPlan = plan;
        renderPrepPlan(plan);
        dom.setupPhase.classList.add("hidden");
        dom.interviewPhase.classList.add("hidden");
        dom.prepPhase?.classList.remove("hidden");
    } catch (error) {
        console.error("Prep plan failed:", error);
        alert("The prep plan could not be generated. Please check whether the backend server is running.");
    } finally {
        dom.startInterviewBtn.disabled    = false;
        dom.startInterviewBtn.textContent = getSelectedPrepMode() === "prep"
            ? "Create Prep Plan"
            : "Continue to Interview";
    }
}

async function requestPrepPlan() {
    const response = await fetch("http://localhost:3000/interview-loop", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action:          "prep-plan",
            jobRole:         state.role,
            resumeFileName:  state.resumeFileName,
            resumeText:      buildResumeContext(),
            hobbies:         extractResumeHobbies(state.resumeText)
        })
    });

    const data = await response.json();
    if (!response.ok || !data.plan) {
        throw new Error(data?.error || "Failed to generate prep plan");
    }
    return data.plan;
}

function renderPrepPlan(plan) {
    dom.prepSummary.textContent  = plan.summary  || "Here is a focused plan based on your role and resume.";
    dom.prepUserName.textContent = plan.candidateName || "Candidate";
    dom.prepUserRole.textContent = state.role;
    renderChips(dom.prepSkillList, plan.keySkills?.length ? plan.keySkills : ["Role basics", "Projects", "Communication"]);
    dom.prepAiSummary.textContent = plan.aiSummary || "Focus on clearer project stories, role-specific fundamentals, and concise interview answers.";
    renderFocusAreas(plan.focusAreas || []);
    renderSimpleList(dom.prepTopicList, plan.keyTopics || []);
    renderSimpleList(dom.prepTipList,   plan.tips     || []);
}

function renderChips(target, items) {
    target.innerHTML = "";
    items.slice(0, 6).forEach((item) => {
        const chip = document.createElement("span");
        chip.textContent = item;
        target.appendChild(chip);
    });
}

function renderFocusAreas(items) {
    const fallback = [
        { title: "Project depth",    explanation: "Prepare clearer stories about what you built, why it mattered, and what trade-offs you made.", priority: "high" },
        { title: "Role fundamentals", explanation: "Review the core concepts interviewers commonly expect for this position.",                      priority: "high" },
        { title: "Answer structure", explanation: "Use concise problem-action-result answers instead of long, unstructured explanations.",          priority: "medium" }
    ];

    dom.prepFocusGrid.innerHTML = "";
    (items.length ? items : fallback).slice(0, 5).forEach((item) => {
        const card     = document.createElement("article");
        const priority = String(item.priority || "medium").toLowerCase() === "high" ? "high" : "medium";
        card.className = "focus-card";
        card.innerHTML = `
            <div>
                <h3>${escapeHtml(item.title       || "Focus area")}</h3>
                <p>${escapeHtml(item.explanation  || "Practice this area before your interview.")}</p>
            </div>
            <span class="priority-pill ${priority}">${priority}</span>
        `;
        dom.prepFocusGrid.appendChild(card);
    });
}

function renderSimpleList(target, items) {
    const fallback = target === dom.prepTopicList
        ? ["Role-specific fundamentals", "Resume project walkthroughs", "Common behavioral examples"]
        : ["Keep answers under two minutes.", "Use specific metrics when possible.", "Prepare one story for conflict, ownership, and failure."];

    target.innerHTML = "";
    (items.length ? items : fallback).slice(0, 7).forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        target.appendChild(li);
    });
}

// ─── Resume parsing ──────────────────────────────────────────────────────────

async function extractResumeText(file) {
    const extension = file.name.split(".").pop()?.toLowerCase();

    try {
        if (extension === "pdf" && window.pdfjsLib) {
            return await extractPdfText(file);
        }
        if (extension === "docx" && window.mammoth) {
            const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
            return sanitizeExtractedText(result.value);
        }
    } catch (error) {
        console.error("Resume extraction failed:", error);
    }
    return "";
}

async function extractPdfText(file) {
    const pdf   = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page    = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => item.str).join(" "));
    }
    return sanitizeExtractedText(pages.join("\n"));
}

function sanitizeExtractedText(text) {
    return String(text || "").replace(/\s+/g, " ").trim().slice(0, 12000);
}

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g,  "&amp;")
        .replace(/</g,  "&lt;")
        .replace(/>/g,  "&gt;")
        .replace(/"/g,  "&quot;")
        .replace(/'/g,  "&#39;");
}

// ─── Question flow ───────────────────────────────────────────────────────────

async function loadNextQuestion() {
    const totalQuestions     = getTotalQuestions();
    const nextQuestionNumber = state.questionIndex + 1;

    if (state.questionIndex >= totalQuestions) {
        endInterview();
        return;
    }

    setStatus("Processing...");
    setWaveformAnimated(true);
    dom.answerInput.value = "";
    dom.answerInput.focus();

    try {
        const question         = await fetchQuestion(nextQuestionNumber);
        state.currentQuestion  = question;
        state.questionIndex   += 1;
        state.questionStartedAt = Date.now();

        state.currentQuestion = {
            ...question,
            isFollowUp:           false,
            followUpDepth:        0,
            parentQuestionNumber: state.questionIndex,
            displayLabel:         `Q ${state.questionIndex}`,
            questionType:         getQuestionTypeForIndex(state.questionIndex)
        };

        await renderQuestion(question);
        startCountdown();
        setWaveformAnimated(false);
        setStatus("Ready to answer");
        updateBriefStatus("Question live");
    } catch (error) {
        console.error(error);
        setWaveformAnimated(false);
        setStatus("Unable to generate question");
        alert(`The interview question could not be generated.\n\n${error.message}`);
    }
}

async function fetchQuestion(questionNumber) {
    const response = await fetch("http://localhost:3000/interview-loop", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action:            "question",
            mode:              state.mode,
            questionType:      getQuestionTypeForIndex(questionNumber),
            jobRole:           state.role,
            resumeText:        buildResumeContext(),
            hobbies:           extractResumeHobbies(state.resumeText),
            questionNumber,
            totalQuestions:    getTotalQuestions(),
            previousQuestions: [
                ...state.answers.map((item) => item.question.question),
                state.currentQuestion?.question
            ].filter(Boolean),
            previousAnswerText: state.answers.at(-1)?.answer || ""
        })
    });

    const data = await response.json();
    if (!response.ok || !data.question) {
        throw new Error(data?.details || data?.error || "Failed to generate question");
    }
    return data.question;
}

// ─── Question rendering ──────────────────────────────────────────────────────

async function renderQuestion(question) {
    stopQuestionNarration();
    const activeQuestion = state.currentQuestion || question;
    const mainNumber     = activeQuestion?.parentQuestionNumber || state.questionIndex;
    const questionText   = activeQuestion?.question;
    const bubbleText     = personalizeOpeningBubble(buildInterviewerBubbleText(activeQuestion), mainNumber);

    if (dom.questionProgress) dom.questionProgress.textContent = "";
    dom.questionSequenceLabel.textContent = activeQuestion?.displayLabel || `Q ${mainNumber}`;
    dom.questionSequenceLabel.classList.toggle("is-followup", Boolean(activeQuestion?.isFollowUp));
    dom.questionCard?.classList.add("is-waiting");
    renderNarratableQuestionText(questionText);
    renderInterviewerBubble(bubbleText);

    if(dom.contextRow) dom.contextRow.classList.add("hidden");
    if(dom.followUpRow) dom.followUpRow.classList.add("hidden");
    await delay(1500);
    dom.questionCard?.classList.remove("is-waiting");

    if (state.questionNarrationEnabled) {
        window.setTimeout(speakCurrentQuestion, 250);
    }
}

function renderInterviewerBubble(text) {
    if (!text) {
        dom.interviewerBubble?.classList.add("hidden");
        return;
    }
    dom.interviewerBubbleText.textContent = text;
    dom.interviewerBubble?.classList.remove("hidden");
}

function buildInterviewerBubbleText(question) {
    if (question?.isFollowUp) return "Let's go a little deeper on that point.";
    return [question?.acknowledgement, question?.transition]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(" ");
}

function personalizeOpeningBubble(text, questionNumber) {
    const candidateName = getCandidateFirstName();
    if (Number(questionNumber) !== 1 || !candidateName || !text) return text;
    if (new RegExp(`\\b${candidateName}\\b`, "i").test(text)) return text;
    return text
        .replace(/^Hey,\s*/i,            `Hey ${candidateName}, `)
        .replace(/^Hey\s+welcome\b/i,    `Hey ${candidateName}, welcome`);
}

function getCandidateFirstName() {
    const resumeText = String(state.resumeText || "").replace(/\r/g, "\n").trim();
    const lines = resumeText
        .split(/\n| {2,}/)
        .map((line) => line.trim())
        .filter(Boolean);
    const nameMatch  = resumeText.match(/\b(?:name|candidate name)\s*[:\-]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/);
    const resumeName = [nameMatch?.[1], ...lines.slice(0, 5).filter(looksLikePersonName)]
        .filter(Boolean)
        .map(cleanFirstName)
        .find(isValidFirstName);
    if (resumeName) return resumeName;

    const cleaned = String(state.resumeFileName || "")
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/[_\-]+/g, " ")
        .replace(/\b(?:resume|cv|final|updated|latest|copy|pdf|docx)\b/gi, " ")
        .replace(/\d+/g,       " ")
        .replace(/[^a-zA-Z\s]/g, " ")
        .replace(/\s+/g,       " ")
        .trim();
    const fileName = cleanFirstName(cleaned.split(" ")[0] || "");
    return isValidFirstName(fileName) ? fileName : "";
}

function looksLikePersonName(line = "") {
    const cleaned = String(line).replace(/[^a-zA-Z\s]/g, " ").replace(/\s+/g, " ").trim();
    const words   = cleaned.split(" ").filter(Boolean);
    return words.length >= 2
        && words.length <= 3
        && !/\d/.test(line)
        && words.every((word) => /^[A-Z][a-z]+$/.test(word) || /^[A-Z]{2,}$/.test(word));
}

function cleanFirstName(value = "") {
    const word = String(value).replace(/[^a-zA-Z]/g, "").trim();
    return word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : "";
}

function isValidFirstName(name = "") {
    return Boolean(name)
        && name.length >= 2
        && !/^\d+$/.test(name)
        && !/^(target|role|frontend|backend|developer|engineer|software|data|fullstack|full|stack)$/i.test(name);
}

function renderNarratableQuestionText(text) {
    state.narratedWordSpans  = [];
    dom.questionText.innerHTML = "";
    const words = String(text || "").trim().split(/\s+/).filter(Boolean);
    words.forEach((word, index) => {
        const span      = document.createElement("span");
        span.className  = "narration-word";
        span.textContent = word;
        state.narratedWordSpans.push(span);
        dom.questionText.appendChild(span);
        if (index < words.length - 1) {
            dom.questionText.appendChild(document.createTextNode(" "));
        }
    });
}

// ─── Narration ───────────────────────────────────────────────────────────────

function handleQuestionNarrationToggle() {
    state.questionNarrationEnabled = Boolean(dom.questionNarrationToggle?.checked);
    localStorage.setItem("mockmateNarrationEnabled", String(state.questionNarrationEnabled));
    updateQuestionNarrationLabel();
    if (state.questionNarrationEnabled) {
        speakCurrentQuestion();
    } else {
        stopQuestionNarration();
    }
}

function updateQuestionNarrationLabel() {
    if (dom.questionNarrationLabel) {
        dom.questionNarrationLabel.textContent = state.questionNarrationEnabled ? "Narration On" : "Narration Off";
    }
}

function speakCurrentQuestion() {
    if (!state.questionNarrationEnabled) return;

    const SpeechSynthesisUtterance = window.SpeechSynthesisUtterance;
    if (!SpeechSynthesisUtterance || !window.speechSynthesis) {
        alert("Question narration is not supported in this browser.");
        state.questionNarrationEnabled = false;
        if (dom.questionNarrationToggle) dom.questionNarrationToggle.checked = false;
        updateQuestionNarrationLabel();
        return;
    }

    const acknowledgementText = dom.interviewerBubbleText?.textContent.trim() || "";
    const questionText        = state.currentQuestion?.question || dom.questionText.textContent.trim();
    if (!acknowledgementText && !questionText) return;

    stopQuestionNarration();

    const speakQuestion = () => {
        if (!state.questionNarrationEnabled || !questionText) return;
        const questionUtterance       = createNarrationUtterance(questionText);
        questionUtterance.onstart     = () => {
            dom.questionText?.classList.add("is-speaking");
            startNarrationHighlightFallback();
            highlightNarratedWord(0);
        };
        questionUtterance.onboundary  = (event) => highlightNarratedWord(event.charIndex);
        questionUtterance.onend       = stopQuestionNarration;
        questionUtterance.onerror     = stopQuestionNarration;
        state.questionNarration       = questionUtterance;
        window.speechSynthesis.speak(questionUtterance);
    };

    if (acknowledgementText) {
        const acknowledgementUtterance = createNarrationUtterance(acknowledgementText);
        acknowledgementUtterance.onend  = () => {
            state.narrationPauseTimer = window.setTimeout(speakQuestion, 1000);
        };
        acknowledgementUtterance.onerror = stopQuestionNarration;
        state.questionNarration          = acknowledgementUtterance;
        window.speechSynthesis.speak(acknowledgementUtterance);
        return;
    }

    speakQuestion();
}

function createNarrationUtterance(text) {
    const utterance   = new SpeechSynthesisUtterance(text);
    utterance.rate    = 0.95;
    utterance.pitch   = 1;
    return utterance;
}

function startNarrationHighlightFallback() {
    clearInterval(state.narrationHighlightTimer);
    const spans = state.narratedWordSpans || [];
    if (!spans.length) return;
    let index = 0;
    state.narrationHighlightTimer = setInterval(() => {
        if (!state.questionNarration || index >= spans.length) {
            clearInterval(state.narrationHighlightTimer);
            state.narrationHighlightTimer = null;
            return;
        }
        spans.forEach((span, spanIndex) => {
            span.classList.toggle("is-narrating", spanIndex === index);
            span.classList.toggle("was-narrated",  spanIndex < index);
        });
        index += 1;
    }, 320);
}

function highlightNarratedWord(charIndex) {
    const spans = state.narratedWordSpans || [];
    let cursor      = 0;
    let activeIndex = -1;
    spans.forEach((span, index) => {
        const wordLength = span.textContent.length;
        if (charIndex >= cursor && charIndex < cursor + wordLength) activeIndex = index;
        cursor += wordLength + 1;
    });
    spans.forEach((span, index) => {
        span.classList.toggle("is-narrating", index === activeIndex);
        span.classList.toggle("was-narrated",  activeIndex > index);
    });
}

function stopQuestionNarration() {
    clearTimeout(state.narrationPauseTimer);
    state.narrationPauseTimer = null;
    clearInterval(state.narrationHighlightTimer);
    state.narrationHighlightTimer = null;
    if (window.speechSynthesis?.speaking || window.speechSynthesis?.pending) {
        window.speechSynthesis.cancel();
    }
    state.questionNarration = null;
    dom.questionText?.classList.remove("is-speaking");
    state.narratedWordSpans?.forEach((span) => span.classList.remove("is-narrating", "was-narrated"));
}

// ─── Countdown ───────────────────────────────────────────────────────────────

function startCountdown() {
    clearInterval(state.countdownId);
    state.secondsLeft = QUESTION_TIME_LIMIT;
    updateCountdown();

    state.countdownId = setInterval(() => {
        state.secondsLeft -= 1;
        updateCountdown();
        if (state.secondsLeft <= 0) {
            clearInterval(state.countdownId);
            skipQuestion(true);
        }
    }, 1000);
}

function updateCountdown() {
    const minutes = Math.floor(state.secondsLeft / 60);
    const seconds = state.secondsLeft % 60;
    dom.countdownTimer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    dom.countdownTimer.classList.toggle("is-warning",  state.secondsLeft <= 30 && state.secondsLeft > 10);
    dom.countdownTimer.classList.toggle("is-critical", state.secondsLeft <= 10);
}

// ─── Answer submission ───────────────────────────────────────────────────────

async function submitAnswer() {
    stopDictation(true);
    const answer = dom.answerInput.value.trim();
    if (!answer) {
        alert("Please record or type an answer before submitting.");
        return;
    }
    await handleSubmittedAnswer(answer);
}

function handleAnswerInputKeydown(event) {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    submitAnswer();
}

async function handleSubmittedAnswer(answer) {
    if (state.currentQuestion?.isJokeQuestion || state.isJokeTurn) {
        await handleJokeAnswer(answer);
        return;
    }

    if (isCandidateClarificationQuestion(answer)) {
        await handleCandidateClarification(answer);
        return;
    }

    const followUpMode     = getFollowUpModeForCurrentQuestion();
    const feedbackPromise  = evaluateAnswer(answer, false);
    const followUpPromise  = followUpMode
        ? requestFollowUp(answer, followUpMode)
        : Promise.resolve({ needsFollowUp: false, followUpQuestion: null });

    const feedback = await feedbackPromise;
    if (!feedback) return;

    storeAnswer(answer, feedback, false);

    const followUp = await followUpPromise;
    recordFollowUpDecision(followUpMode, followUp);
    if (followUp?.needsFollowUp && followUp.followUpQuestion) {
        state.followUpUsed = true;
        showFollowUpQuestion(followUp.followUpQuestion);
        return;
    }

    await advanceAfterCurrentQuestion();
}

function isCandidateClarificationQuestion(answer = "") {
    const text = String(answer || "").trim();
    if (!text) return false;

    const words = text.split(/\s+/).filter(Boolean);
    const startsLikeQuestion = /^(what|why|how|when|where|who|which|can|could|would|should|do|does|did|is|are|am|will|may|please|explain|clarify|repeat|rephrase|mean)\b/i.test(text);
    const asksForHelp = /\b(repeat|rephrase|clarify|explain|example|hint|meaning|mean|understand|what do you mean|can you tell|could you tell)\b/i.test(text);

    return text.endsWith("?") || (words.length <= 22 && (startsLikeQuestion || asksForHelp));
}

async function handleCandidateClarification(answer) {
    clearInterval(state.countdownId);
    stopDictation(true);
    setStatus("Answering question...");
    setWaveformAnimated(true);
    updateBriefStatus("Clarifying question");

    try {
        const response = await fetch("http://localhost:3000/interview-loop", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action:        "clarify",
                mode:          state.mode,
                questionType:  state.currentQuestion?.questionType || getQuestionTypeForIndex(state.questionIndex),
                jobRole:       state.role,
                resumeText:    buildResumeContext(),
                questionNumber: state.questionIndex,
                totalQuestions: getTotalQuestions(),
                question:      state.currentQuestion,
                answerText:    answer
            })
        });

        const data = await response.json();
        if (!response.ok || !data.clarification) {
            throw new Error(data?.details || data?.error || "Failed to answer clarification");
        }

        const clarification = data.clarification.answer || "Good question. Take a moment, then answer the current question when you are ready.";
        renderInterviewerBubble(clarification);
        if (state.questionNarrationEnabled) {
            stopQuestionNarration();
            const utterance = createNarrationUtterance(clarification);
            utterance.onerror = stopQuestionNarration;
            state.questionNarration = utterance;
            window.speechSynthesis.speak(utterance);
        }
    } catch (error) {
        console.error(error);
        renderInterviewerBubble("Good question. Please answer the current question based on your best understanding, and I will evaluate that response.");
    } finally {
        dom.answerInput.value = "";
        dom.answerInput.focus();
        state.questionStartedAt = Date.now();
        startCountdown();
        setWaveformAnimated(false);
        setStatus("Ready to answer");
        updateBriefStatus("Question live");
    }
}

function getFollowUpModeForCurrentQuestion() {
    const parentQuestionNumber = state.currentQuestion?.parentQuestionNumber || state.questionIndex;
    const followUpDepth        = state.currentQuestion?.followUpDepth || 0;
    if (state.followUpUsed || followUpDepth > 0) return null;
    if (parentQuestionNumber === 3) return "decide";
    if (parentQuestionNumber === 4 && state.question3NeedsFollowUp === false) return "force";
    return null;
}

function recordFollowUpDecision(followUpMode, followUp) {
    if (followUpMode === "decide") {
        state.question3NeedsFollowUp = Boolean(followUp?.needsFollowUp);
    }
}

function resetFollowUpState() {
    state.followUpUsed          = false;
    state.question3NeedsFollowUp = null;
}

// ─── Skip ────────────────────────────────────────────────────────────────────

async function skipQuestion(triggeredByTimer = false) {
    if (!state.currentQuestion) return;

    clearInterval(state.countdownId);
    stopDictation(true);

    const feedback = {
        overallScore: 0,
        score:        0,
        summary: "The candidate is not ready for this role yet. The question was skipped, so there is no evidence to evaluate.",
        subScores:    { clarity: 20, technicalDepth: 0, useOfExamples: 0, confidence: 15 },
        strengths:    ["No notable strengths in this response."],
        weaknesses:   [triggeredByTimer ? "Time ran out before you answered." : "The question was skipped."],
        improvements: [
            "Give at least a short structured answer, even if you are unsure.",
            "Explain one relevant concept and one real project example instead of skipping.",
            "State the tool or implementation detail you would use in practice."
        ],
        improve: [
            "Give at least a short structured answer, even if you are unsure.",
            "Explain one relevant concept and one real project example instead of skipping.",
            "State the tool or implementation detail you would use in practice."
        ],
        metrics:      { overallScore: 0, clarity: 20, technicalDepth: 0, useOfExamples: 0, confidence: 15 },
        questionReviews: [{
            question: state.currentQuestion?.question || "",
            answer:   "",
            score:    0,
            strength: "No notable strength.",
            weakness: triggeredByTimer ? "Time ran out before you answered." : "The question was skipped.",
            improve:  "Give at least a short structured answer, even if you are unsure."
        }],
        fillerCount: 0
    };

    storeAnswer("", feedback, true);

    if (state.questionIndex >= getTotalQuestions()) {
        endInterview();
        return;
    }

    setStatus("Processing...");
    await loadNextQuestion();
}

// ─── Evaluate ────────────────────────────────────────────────────────────────

async function evaluateAnswer(answer, skipped) {
    clearInterval(state.countdownId);
    setStatus("Processing...");
    setWaveformAnimated(true);
    updateBriefStatus("Evaluating answer");

    try {
        const response = await fetch("http://localhost:3000/interview-loop", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action:        "evaluate",
                mode:          state.mode,
                questionType:  state.currentQuestion?.questionType || getQuestionTypeForIndex(state.questionIndex),
                jobRole:       state.role,
                resumeText:    buildResumeContext(),
                questionNumber: state.questionIndex,
                totalQuestions: getTotalQuestions(),
                question:      state.currentQuestion,
                answerText:    answer
            })
        });

        const data = await response.json();
        if (!response.ok || !data.feedback) {
            throw new Error(data?.details || data?.error || "Failed to evaluate answer");
        }

        setWaveformAnimated(false);
        setStatus("Processing...");
        updateBriefStatus("Feedback ready");
        return data.feedback;
    } catch (error) {
        console.error(error);
        setWaveformAnimated(false);
        setStatus("Evaluation failed");
        alert(`The answer could not be evaluated.\n\n${error.message}`);
        return null;
    }
}

function storeAnswer(answer, feedback, skipped) {
    const responseTimeSeconds = state.questionStartedAt
        ? Math.max(1, Math.round((Date.now() - state.questionStartedAt) / 1000))
        : 0;

    state.answers.push({ question: state.currentQuestion, answer, feedback, skipped, responseTimeSeconds });
}

async function requestFollowUp(answer, followUpMode) {
    try {
        const response = await fetch("http://localhost:3000/interview-loop", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action:       "follow-up",
                mode:         state.mode,
                questionType: state.currentQuestion?.questionType || getQuestionTypeForIndex(state.questionIndex),
                question:     state.currentQuestion,
                answerText:   answer,
                forceFollowUp: followUpMode === "force"
            })
        });

        const data = await response.json();
        if (!response.ok || !data.followUp) return { needsFollowUp: false, followUpQuestion: null };
        return data.followUp;
    } catch (error) {
        console.error("Follow-up request failed:", error);
        return { needsFollowUp: false, followUpQuestion: null };
    }
}

function showFollowUpQuestion(followUpQuestion) {
    const parentQuestionNumber = state.currentQuestion.parentQuestionNumber;
    const followUpDepth        = (state.currentQuestion.followUpDepth || 0) + 1;
    state.currentQuestion = {
        question:             followUpQuestion,
        context:              "",
        followUp:             "",
        tip:                  "",
        isFollowUp:           true,
        followUpDepth,
        parentQuestionNumber,
        displayLabel:         `Q ${parentQuestionNumber}.${followUpDepth}`,
        questionType:         state.currentQuestion?.questionType || getQuestionTypeForIndex(parentQuestionNumber)
    };
    state.questionStartedAt = Date.now();
    dom.answerInput.value   = "";
    renderQuestion(state.currentQuestion).then(startCountdown);
    setStatus("Ready to answer");
    updateBriefStatus("Follow-up live");
}

async function advanceAfterCurrentQuestion() {
    // FIX #7: Guard against ending mid-follow-up leaving the last answer unsaved.
    // state.questionIndex is only incremented during loadNextQuestion, so if we are
    // on a follow-up the index hasn't advanced — check answers length instead.
    if (state.answers.length >= getTotalQuestions()) {
        endInterview();
        return;
    }
    if (state.questionIndex >= getTotalQuestions()) {
        endInterview();
        return;
    }
    if (shouldShowMixedTransition()) await showMixedTransition();
    await loadNextQuestion();
}

// ─── Mode helpers ─────────────────────────────────────────────────────────────

function syncPrepModeSelection() {
    dom.prepModes.forEach((input) => {
        input.closest(".mode-option")?.classList.toggle("is-selected", input.checked);
    });
    updateInterviewModePanelVisibility();
    dom.startInterviewBtn.textContent = getSelectedPrepMode() === "prep"
        ? "Create Prep Plan"
        : "Continue to Interview";
}

function updateInterviewModePanelVisibility() {
    const selectedPrepMode = document.querySelector('input[name="prepMode"]:checked')?.value || "live";
    dom.interviewModePanel?.classList.toggle("is-hidden", selectedPrepMode !== "live");
}

function syncInterviewModeSelection() {
    dom.interviewModes.forEach((input) => {
        input.closest(".interview-mode-option")?.classList.toggle("is-selected", input.checked);
    });
}

function getSelectedInterviewMode() {
    return document.querySelector('input[name="interviewMode"]:checked')?.value || "mixed";
}

function getSelectedPrepMode() {
    return document.querySelector('input[name="prepMode"]:checked')?.value || "live";
}

function getTotalQuestions() {
    return state.mode === "mixed" ? MIXED_TOTAL_QUESTIONS : TOTAL_QUESTIONS;
}

function getQuestionTypeForIndex(questionNumber) {
    if (state.mode === "hr") return "hr";
    if (state.mode === "mixed" && questionNumber > MIXED_TECHNICAL_QUESTIONS) return "hr";
    return "technical";
}

function shouldShowMixedTransition() {
    return state.mode === "mixed" && state.questionIndex === MIXED_TECHNICAL_QUESTIONS;
}

async function showMixedTransition() {
    clearInterval(state.countdownId);
    setWaveformAnimated(false);
    setStatus("Round transition");
    updateBriefStatus("Moving to HR round");
    if (dom.questionProgress) dom.questionProgress.textContent = "";
    dom.questionSequenceLabel.textContent = "HR Round";
    dom.questionSequenceLabel.classList.remove("is-followup");
    if(dom.contextRow) dom.contextRow.classList.add("hidden");
    if(dom.followUpRow) dom.followUpRow.classList.add("hidden");
    dom.questionText.textContent = "Great work on the technical round. Now let's talk about you as a person.";
    dom.answerInput.value        = "";
    await new Promise((resolve) => setTimeout(resolve, 1800));
}

// ─── Dictation ───────────────────────────────────────────────────────────────

function toggleDictation() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Speech recognition is not supported in this browser.");
        return;
    }
    if (state.recognition) { stopDictation(true); return; }
    startDictation(SpeechRecognition);
}

function startDictation(SpeechRecognition) {
    clearTimeout(state.dictationRestartTimer);
    clearTimeout(state.dictationSilenceTimer);
    state.dictationRestartTimer     = null;
    state.dictationSilenceTimer     = null;
    state.dictationManualStop       = false;
    state.dictationFinalTranscript  = dom.answerInput.value.trim();

    const recognition              = new SpeechRecognition();
    recognition.continuous         = true;
    recognition.interimResults     = true;
    recognition.lang               = "en-US";

    recognition.onstart = () => {
        state.recognition = recognition;
        dom.micBtn.classList.add("is-active");
        setWaveformAnimated(true);
        startLiveWaveform();
        setStatus("Listening...");
        updateBriefStatus("Listening");
    };

    recognition.onspeechstart = () => {
        clearTimeout(state.dictationSilenceTimer);
        state.dictationSilenceTimer = null;
        setStatus("Recording...");
    };

    recognition.onspeechend = () => { scheduleDictationSilenceStop(); };

    recognition.onresult = (event) => {
        clearTimeout(state.dictationSilenceTimer);
        state.dictationSilenceTimer = null;
        let interimTranscript = "";

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const transcript = event.results[index][0].transcript.trim();
            if (event.results[index].isFinal) {
                state.dictationFinalTranscript = `${state.dictationFinalTranscript} ${transcript}`.trim();
            } else {
                interimTranscript = `${interimTranscript} ${transcript}`.trim();
            }
        }

        dom.answerInput.value = `${state.dictationFinalTranscript} ${interimTranscript}`.trim();
        scheduleDictationSilenceStop();
    };

    recognition.onerror = () => {
        if (!state.dictationManualStop) setStatus("Listening...");
    };

    recognition.onend = () => {
        state.recognition = null;
        if (!state.dictationManualStop && !state.completed) {
            state.dictationRestartTimer = window.setTimeout(() => startDictation(SpeechRecognition), 700);
            setStatus("Listening...");
            return;
        }
        dom.micBtn.classList.remove("is-active");
        setWaveformAnimated(false);
        stopLiveWaveform();
        setStatus(dom.statusText.textContent === "Processing..." ? "Processing..." : "Ready to answer");
        updateBriefStatus("Question live");
    };

    try {
        recognition.start();
    } catch (error) {
        state.recognition = null;
        dom.micBtn.classList.remove("is-active");
        setWaveformAnimated(false);
        stopLiveWaveform();
        setStatus("Voice input unavailable");
    }
}

function stopDictation(manualStop = false) {
    clearTimeout(state.dictationRestartTimer);
    clearTimeout(state.dictationSilenceTimer);
    state.dictationRestartTimer = null;
    state.dictationSilenceTimer = null;
    state.dictationManualStop   = manualStop;
    if (state.recognition) { state.recognition.stop(); return; }
    dom.micBtn.classList.remove("is-active");
    setWaveformAnimated(false);
    stopLiveWaveform();
}

function scheduleDictationSilenceStop() {
    if (!state.recognition || !dom.answerInput.value.trim()) return;
    clearTimeout(state.dictationSilenceTimer);
    state.dictationSilenceTimer = window.setTimeout(() => stopDictation(true), 3800);
}

// ─── Waveform ────────────────────────────────────────────────────────────────

function setStatus(text)            { dom.statusText.textContent = text; }
function updateBriefStatus(text)    { dom.briefStatus.textContent = text; }

function setWaveformAnimated(isAnimated) {
    dom.waveform?.classList.toggle("is-animated", isAnimated);
    if (!isAnimated) resetWaveformBars();
}

async function startLiveWaveform() {
    if (state.waveformAnimationId || !navigator.mediaDevices?.getUserMedia) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        state.waveformStream        = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.waveformAudioContext  = new AudioContext();
        state.waveformAnalyser      = state.waveformAudioContext.createAnalyser();
        state.waveformAnalyser.fftSize = 64;
        state.waveformAnalyser.smoothingTimeConstant = 0.72;
        state.waveformSource        = state.waveformAudioContext.createMediaStreamSource(state.waveformStream);
        state.waveformSource.connect(state.waveformAnalyser);
        renderLiveWaveform();
    } catch (error) {
        console.error("Live waveform unavailable:", error);
    }
}

function renderLiveWaveform() {
    if (!state.waveformAnalyser || !dom.waveform) return;

    const bars = Array.from(dom.waveform.querySelectorAll("span"));
    const data = new Uint8Array(state.waveformAnalyser.frequencyBinCount);
    state.waveformAnalyser.getByteTimeDomainData(data);

    bars.forEach((bar, index) => {
        const dataIndex    = Math.floor((index / Math.max(1, bars.length - 1)) * (data.length - 1));
        const volume       = Math.abs(data[dataIndex] - 128) / 128;
        const shapedVolume = Math.min(1, volume * 3.8);
        const height       = 2 + shapedVolume * 24;
        bar.style.height   = `${height.toFixed(1)}px`;
        bar.style.opacity  = String(0.34 + shapedVolume * 0.66);
    });

    state.waveformAnimationId = window.requestAnimationFrame(renderLiveWaveform);
}

function stopLiveWaveform() {
    if (state.waveformAnimationId) {
        window.cancelAnimationFrame(state.waveformAnimationId);
        state.waveformAnimationId = null;
    }
    state.waveformSource?.disconnect();
    state.waveformSource      = null;
    state.waveformAnalyser    = null;
    state.waveformAudioContext?.close();
    state.waveformAudioContext = null;
    state.waveformStream?.getTracks().forEach((track) => track.stop());
    state.waveformStream = null;
    resetWaveformBars();
}

function resetWaveformBars() {
    dom.waveform?.querySelectorAll("span").forEach((bar) => {
        bar.style.height  = "";
        bar.style.opacity = "";
    });
}

// ─── Resume helpers ───────────────────────────────────────────────────────────

// FIX #6: buildResumeContext now includes the full extracted resume text so every
// AI call receives the candidate's actual resume content, not just a few lines.
function buildResumeContext() {
    const parts = [
        `Target role: ${state.role}`,
        `Resume file: ${state.resumeFileName}`
    ];
    if (state.resumeNotes) parts.push(`Candidate notes: ${state.resumeNotes}`);
    if (state.resumeText)  parts.push(`Resume content:\n${state.resumeText}`);
    return parts.join("\n");
}

function extractResumeHobbies(resumeText = "") {
    const text         = String(resumeText || "");
    const sectionMatch = text.match(/\b(?:hobbies|interests|about me|personal|extra-?curricular|activities)\b\s*[:\-]?\s*([\s\S]{0,350})/i);
    if (!sectionMatch) return [];
    return sectionMatch[1]
        .split(/\n|,|;|•|-|\|/)
        .map((item) => item.replace(/\b(?:skills|education|experience|projects|certifications)\b[\s\S]*$/i, "").trim())
        .filter((item) => item.length >= 3 && item.length <= 50)
        .slice(0, 3);
}

// ─── Camera & eye tracking ────────────────────────────────────────────────────

async function initCameraAndEyeTracking() {
    if (!navigator.mediaDevices?.getUserMedia || !window.faceapi) {
        setCameraIndicator("Camera unavailable", "warning");
        return;
    }

    try {
        if (!state.faceModelsLoaded) {
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(FACE_API_MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(FACE_API_MODEL_URL)
            ]);
            state.faceModelsLoaded = true;
        }

        state.webcamStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: 640, height: 480 },
            audio: false
        });

        dom.selfViewVideo.srcObject = state.webcamStream;
        await dom.selfViewVideo.play().catch(() => {});
        setCameraIndicator("Look at camera", "warning");

        clearInterval(state.eyeDetectionIntervalId);
        state.eyeDetectionIntervalId = setInterval(analyzeEyeContactFrame, 500);
    } catch (error) {
        console.error("Camera init failed:", error);
        setCameraIndicator("Camera unavailable", "warning");
    }
}

async function analyzeEyeContactFrame() {

    if (
        !state.faceModelsLoaded ||
        !dom.selfViewVideo ||
        dom.selfViewVideo.readyState < 2
    ) return;

    try {

        const detections = await faceapi
            .detectAllFaces(dom.selfViewVideo, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks();

        if (detections.length === 0) {
            setCameraIndicator("No Face Detected", "warning");
            showWarning("Please stay in front of the camera");
            return;
        }

        if (detections.length > 1) {
            setCameraIndicator("Multiple Faces Detected", "danger");
            showWarning("Cheating detected! Multiple people found.");
            console.warn("Multiple faces detected:", detections.length);
            return;
        }

        const detection = detections[0];

        if (!detection?.landmarks) {
            setCameraIndicator("Look at camera", "warning");
            return;
        }

        const positions = detection.landmarks.positions;
        if (!positions || positions.length < 48) {
            console.warn("Unexpected landmark count:", positions?.length);
            setCameraIndicator("Camera Error", "danger");
            return;
        }

        state.totalFrames += 1;

        const subjectLeftEye  = averagePoints(positions.slice(36, 42));
        const subjectRightEye = averagePoints(positions.slice(42, 48));
        const noseTip         = positions[30];

        const eyeMidX     = (subjectLeftEye.x + subjectRightEye.x) / 2;
        const eyeMidY     = (subjectLeftEye.y + subjectRightEye.y) / 2;
        const eyeDistance = Math.abs(subjectRightEye.x - subjectLeftEye.x);

        if (eyeDistance < 1) {
            setCameraIndicator("Look at camera", "warning");
            return;
        }

        const noseCentered = Math.abs(noseTip.x - eyeMidX) <= eyeDistance * 0.18;
        const noseDropRatio     = (noseTip.y - eyeMidY) / eyeDistance;
        const faceNotTiltedDown = noseDropRatio <= 0.78;

        const eyeContact = noseCentered && faceNotTiltedDown;

        if (eyeContact) {
            state.eyeContactFrames   += 1;
            state.noEyeContactFrames  = 0;
            setCameraIndicator("Eye Contact ✓", "good");
        } else {
            state.noEyeContactFrames  += 1;
            state.eyeContactFrames     = 0;
            setCameraIndicator("Look at camera", "warning");
            if (state.noEyeContactFrames > NO_EYE_CONTACT_THRESHOLD) {
                showWarning("Please maintain eye contact");
            }
        }

    } catch (error) {
        console.error("Eye contact detection error:", error);
        setCameraIndicator("Camera Error", "danger");
    }
}

function averagePoints(points) {
    if (!points || points.length === 0) return { x: 0, y: 0 };
    const total = points.reduce(
        (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
        { x: 0, y: 0 }
    );
    return { x: total.x / points.length, y: total.y / points.length };
}

function setCameraIndicator(text, stateClass) {
    if (!dom.cameraIndicator || !dom.cameraIndicatorText) return;
    dom.cameraIndicator.classList.remove("is-good", "is-warning");
    dom.cameraIndicator.classList.add(stateClass === "good" ? "is-good" : "is-warning");
    dom.cameraIndicatorText.textContent = text;
}

function stopCameraTracking() {
    clearInterval(state.eyeDetectionIntervalId);
    state.eyeDetectionIntervalId = null;
    if (state.webcamStream) {
        state.webcamStream.getTracks().forEach((track) => track.stop());
        state.webcamStream = null;
    }
}

// ─── Joke handling ────────────────────────────────────────────────────────────

async function handleJokeAnswer(answer) {
    const jokeStage = state.isJokeTurn ? "punchline" : "auto";

    const response = await fetch("http://localhost:3000/interview-loop", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "joke-reaction", answerText: answer, jokeStage })
    });

    const data     = await response.json();
    const reaction = data.reaction;

    if (dom.interviewerBubbleText) {
        dom.interviewerBubbleText.textContent = reaction.acknowledgement;
    }

    if (state.questionNarrationEnabled && reaction.acknowledgement) {
        stopQuestionNarration();
        const utterance    = createNarrationUtterance(reaction.acknowledgement);
        utterance.onerror  = stopQuestionNarration;
        state.questionNarration = utterance;
        window.speechSynthesis.speak(utterance);
    }

    if (reaction.isJokeTurn && reaction.question === "---") {
        state.isJokeTurn       = true;
        dom.answerInput.value  = "";
        if (dom.questionCard) dom.questionCard.style.display = "none";
        return;
    }

    state.isJokeTurn = false;
    if (dom.questionCard) dom.questionCard.style.display = "";
    dom.answerInput.value = "";
    await advanceAfterCurrentQuestion();
}

// ─── End interview ────────────────────────────────────────────────────────────

async function endInterview() {
    if (state.completed) return;

    if (!state.answers.length) {
        alert("Complete at least one question before ending the interview.");
        return;
    }

    state.completed = true;
    clearInterval(state.countdownId);
    stopDictation(true);
    stopQuestionNarration();
    stopCameraTracking();

    const totalTimeSeconds  = Math.max(1, Math.round((Date.now() - state.interviewStartedAt) / 1000));
    const eyeContactPercent = state.totalFrames
        ? Math.round((state.eyeContactFrames / state.totalFrames) * 100)
        : 0;

    const sessionData = {
        role:               state.role,
        mode:               state.mode,
        resumeFileName:     state.resumeFileName,
        resumeNotes:        state.resumeNotes,
        totalQuestions:     getTotalQuestions(),
        answeredQuestions:  state.answers.length,
        timeSeconds:        totalTimeSeconds,
        answers:            state.answers,
        eyeContactFrames:   state.eyeContactFrames,
        totalFrames:        state.totalFrames,
        eyeContactPercent
    };

    localStorage.setItem("mockmateResult", JSON.stringify(sessionData));

    const user = await getCurrentUser();
    if (user) {
        const profileName = await getUserProfileName(user);
        const totalScore = state.answers.reduce((sum, a) => sum + (a.feedback?.overallScore || 0), 0);
        const avgScore   = Math.round(totalScore / state.answers.length);

        try {
            await addDoc(collection(db, "interviews"), {
                userId:            user.uid,
                userEmail:         user.email || "",
                displayName:       user.displayName || "",
                candidateName:     profileName || user.displayName || getCandidateFirstName() || "",
                role:              state.role,
                mode:              state.mode,
                score:             avgScore,
                date:              new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
                totalQuestions:    getTotalQuestions(),
                answeredQuestions: state.answers.length,
                eyeContactPercent,
                answers:           state.answers,
                createdAt:         new Date()
            });
            console.log("Interview saved to Firestore.");
        } catch (error) {
            console.error("Failed to save to Firestore:", error);
        }
    } else {
        console.warn("No logged-in user — interview not saved.");
    }

    window.location.href = "result.html";
}

function getCurrentUser() {
    if (auth.currentUser) return Promise.resolve(auth.currentUser);

    return new Promise((resolve) => {
        let unsubscribe = () => {};
        const timeoutId = window.setTimeout(() => {
            unsubscribe();
            resolve(null);
        }, 1500);

        unsubscribe = onAuthStateChanged(auth, (user) => {
            window.clearTimeout(timeoutId);
            unsubscribe();
            resolve(user);
        });
    });
}

async function getUserProfileName(user) {
    try {
        const profileSnap = await getDoc(doc(db, "users", user.uid));
        const profile = profileSnap.exists() ? profileSnap.data() : {};
        return String(profile.name || profile.fullName || profile.displayName || "").trim();
    } catch (error) {
        console.warn("Could not load user profile name:", error);
        return "";
    }
}

// ─── Email Report ────────────────────────────────────────────────────────────
// FIX #8: handleSendEmail and sendReportToServer are intentionally defined here
// for use by result.html. Wire them up in result.html via:
//   import { handleSendEmail } from "./interview.js";
//   document.getElementById("sendEmailBtn").addEventListener("click", handleSendEmail);
//
// FIX #1: Removed the duplicate sendReportToServer declaration. There is now a
// single implementation that sends the structured candidateData object (not the
// old reportText string) so the backend receives the correct payload shape.
//
// FIX #2: Removed the top-level `const element = document.getElementById(...)` that
// ran at module load time (before result.html exists). The element is now looked up
// inside handleSendEmail where it is actually needed.

export async function handleSendEmail() {
    const emailInput = document.getElementById("userEmailInput")?.value?.trim();
    const sendBtn    = document.getElementById("sendEmailBtn");

    if (!emailInput || !emailInput.includes("@")) {
        alert("Please enter a valid email address!");
        return;
    }

    sendBtn.innerText = "Generating AI Email & Sending...";
    sendBtn.disabled  = true;

    try {
        // FIX #2: Look up the report container here, not at module load time.
        const element = document.getElementById("reportCardContainer");
        if (!element) throw new Error("Report container not found.");

        const pdfBase64String = await html2pdf().from(element).outputPdf("datauristring");

        const sessionData = JSON.parse(localStorage.getItem("mockmateResult") || "{}");

        let totalScore = 0;
        sessionData.answers?.forEach((a) => { totalScore += a.feedback?.overallScore || 0; });
        const avgScore = sessionData.answers?.length
            ? Math.round(totalScore / sessionData.answers.length)
            : 0;

        const simpleQA = sessionData.answers?.map((a) => ({
            Q: a.question.question,
            A: a.answer
        })) || [];

        const candidateData = {
            role:      sessionData.role || "Software Engineer",
            score:     avgScore,
            qaSummary: simpleQA
        };

        await sendReportToServer(emailInput, candidateData, pdfBase64String);
        alert("AI Report card sent successfully! Check your inbox.");
    } catch (error) {
        console.error("Email Error:", error);
        alert("Failed to send email. Please try again.");
    } finally {
        sendBtn.innerText = "Send Report to Email";
        sendBtn.disabled  = false;
    }
}

// FIX #1: Single sendReportToServer — sends candidateData (structured object), not
// a raw text string. The duplicate declaration that used reportText is removed.
async function sendReportToServer(email, candidateData, base64Pdf) {
    const response = await fetch("http://localhost:3000/send-report", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            userEmail:     email,
            candidateData, // structured object: { role, score, qaSummary }
            pdfBase64:     base64Pdf
        })
    });

    if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
    }

    return await response.json();
}