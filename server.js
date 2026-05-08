import Groq from "groq-sdk";
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

// ==========================================
// 1. APP & MIDDLEWARE SETUP
// ==========================================
const app = express();

// Increase limit for large PDF base64 strings.
app.use(express.json({ limit: '25mb' })); 
app.use(cors());


// ==========================================
// 2. CONFIGURATIONS
// ==========================================

// --- Groq Setup ---
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

// --- Nodemailer Setup ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


// ==========================================
// 3. ROUTES
// ==========================================

// --- Email Route ---
// --- Email Route (Now with AI Integration!) ---
app.post('/send-report', async (req, res) => {
  const { userEmail, pdfBase64, candidateData = {} } = req.body;

  if (!userEmail) {
    return res.status(400).json({ error: "Firebase user email is required." });
  }

  if (!pdfBase64) {
    return res.status(400).json({ error: "PDF report is required." });
  }

  let aiGeneratedEmailText = "Hello! Attached is your MockAI performance report. Keep up the great work!"; // Fallback text

  // 1. Let's ask Groq to write the email
  try {
      const prompt = `
        You are an expert recruiter writing an email to a candidate who just finished a mock interview for a ${candidateData.role} role.
        They scored ${candidateData.score}/100.
        
        Write a short, professional, encouraging 2-paragraph email to the candidate.
        - Paragraph 1: Congratulate them on finishing and highlight one specific strength based on their answers.
        - Paragraph 2: Point out one specific area for improvement and tell them to review the attached PDF for a detailed breakdown.
        
        Do NOT use placeholders like [Candidate Name]. Do NOT include greetings or sign-offs.
        Here is a summary of their Q&A: ${JSON.stringify(candidateData.qaSummary)}
      `;

      if (!groq) {
        throw new Error("GROQ_API_KEY is not configured.");
      }

      const completion = await groq.chat.completions.create({
          model: GROQ_MODEL,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_completion_tokens: 300
      });

      // Override the fallback text with Llama's brilliant writing
      aiGeneratedEmailText = completion.choices[0].message.content; 
  } catch (error) {
      console.error("Groq couldn't generate email, using fallback.", error);
  }

  // 2. Set up the email data using the AI text
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: userEmail,
    subject: 'Your AI-Generated Mock Interview Report',
    text: aiGeneratedEmailText, // <-- Boom! AI text goes here
    attachments: [
      {
        filename: 'ReportCard.pdf',
        content: pdfBase64.split("base64,")[1], 
        encoding: 'base64'
      }
    ]
  };

  // 3. Send the email
  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Email sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email.' });
  }
});

// --- Interview Loop Route ---
app.post("/interview-loop", async (req, res) => {
    const { action } = req.body;

    try {
        if (!GROQ_API_KEY) return res.status(500).json({ error: "GROQ_API_KEY not set" });

        if (action === "question") {
            const result = await generateQuestion(req.body);
            return res.json({ question: result });
        }
        if (action === "clarify") {
            const clarification = await answerCandidateQuestion(req.body);
            return res.json({ clarification });
        }
        if (action === "evaluate") {
            const feedback = await evaluateAnswer(req.body);
            return res.json({ feedback });
        }
        if (action === "follow-up") {
            const followUp = await decideFollowUp(req.body);
            return res.json({ followUp });
        }
        if (action === "prep-plan") {
            const plan = await generatePrepPlan(req.body);
            return res.json({ plan });
        }
        if (action === "joke-reaction") {
            const reaction = await handleJokeTurn(req.body);
            return res.json({ reaction });
        }

        res.status(400).json({ error: "Unsupported action" });
    } catch (error) {
        console.error("Interview error:", error);
        res.status(500).json({ error: "Server error", details: error.message });
    }
});


// ==========================================
// 4. CORE AI FUNCTIONS
// ==========================================
async function generateQuestion({
    jobRole, resumeText, questionNumber, totalQuestions, previousQuestions = [], previousAnswerText = "", mode = "technical", questionType, hobbies = []
}) {
    const activeMode = normalizeMode(mode);
    const activeQuestionType = normalizeQuestionType(questionType, activeMode, questionNumber);
    const resumeSignals = analyzeResumeSignals(resumeText, "", hobbies);
    const candidateName = resumeSignals.candidateName || "Candidate";

    const previousQuestionsStrings = previousQuestions.map(q => 
        typeof q === 'object' && q !== null ? (q.question || q) : q
    ).filter(Boolean);

    const isFirstQuestion = Number(questionNumber) === 1;

    const specialQuestion = chooseSpecialHrQuestion({
        mode: activeMode, questionType: activeQuestionType, questionNumber, totalQuestions, previousQuestions: previousQuestionsStrings, resumeSignals
    });

    const candidateResponse = sanitizeText(previousAnswerText);
    const systemPrompt = buildQuestionSystemPrompt(activeMode, activeQuestionType);

    let userPrompt = `
You are a professional senior interviewer for ${jobRole}.
Mode: ${activeMode} | Type: ${activeQuestionType}
Candidate: ${candidateName}

Resume:
${resumeText}

Previous questions:
${previousQuestionsStrings.length ? previousQuestionsStrings.map((q,i) => `${i+1}. ${q}`).join("\n") : "None"}

Candidate last response:
"${candidateResponse || "None"}"

This is Question ${questionNumber} of ${totalQuestions}.
`;

    if (specialQuestion) {
        userPrompt += `Must ask this: ${specialQuestion.question}\n`;
    }

    userPrompt += `
Return only valid JSON:
{
  "reaction": "Short natural reaction",
  "transition": "Short transition",
  "question": "Next question",
  "display": "Full natural message",
  "tip": "Coaching tip",
  "focusArea": "Topic"
}`;

    const raw = await callGroq(userPrompt, systemPrompt);
    const parsed = parseJsonObject(raw);

    let finalQuestion = sanitizeText(specialQuestion?.question || parsed.question || "");
    if (!finalQuestion) {
        finalQuestion = isFirstQuestion
            ? getOpeningQuestion(activeQuestionType, resumeSignals)
            : getFallbackQuestion(activeQuestionType, questionNumber, previousQuestionsStrings);
    }

    if (previousQuestionsStrings.some(q => normalizeQuestionForComparison(q) === normalizeQuestionForComparison(finalQuestion))) {
        finalQuestion = getFallbackQuestion(activeQuestionType, questionNumber, previousQuestionsStrings);
    }

    return {
        acknowledgement: sanitizeText(parsed.reaction || "Alright."),
        transition: sanitizeText(parsed.transition || "Next question."),
        question: finalQuestion,
        display: sanitizeText(parsed.display),
        tip: sanitizeText(parsed.tip),
        focusArea: specialQuestion?.focusArea || sanitizeText(parsed.focusArea),
        questionType: activeQuestionType,
        isJokeQuestion: isHobbyJokeQuestion(finalQuestion)
    };
}

function buildQuestionSystemPrompt(mode, questionType) {
    return `You are a sharp, experienced senior interviewer.
You are professional, direct, and natural.

Current mode: ${mode}
Question type: ${questionType}

Rules:
- Never repeat the exact same question.
- Vary your reactions.
- Keep questions clear and concise.`;
}

async function generatePrepPlan({ jobRole, resumeText, resumeFileName, hobbies = [] }) {
    const resumeSignals = analyzeResumeSignals(resumeText, resumeFileName, hobbies);
    return {
        candidateName: resumeSignals.candidateName || "Candidate",
        keySkills: ["Communication", "Problem Solving"],
        summary: `Preparation plan for ${jobRole}`,
        aiSummary: "Focus on projects and fundamentals.",
        focusAreas: [],
        keyTopics: ["Core concepts", "Projects"],
        tips: ["Be specific", "Use examples"],
        hobbies: resumeSignals.hobbies
    };
}

async function evaluateAnswer({ jobRole, resumeText, question, answerText }) {
    if (isNonAnswer(answerText)) {
        return buildNonAnswerFeedback(question, answerText);
    }

    const answer = sanitizeText(answerText);
    const wordCount = answer.split(/\s+/).filter(Boolean).length;
    const hasExample = /\b(project|built|created|implemented|developed|worked|used|example|when|because|result|impact)\b/i.test(answer);
    const hasSpecifics = /\b(api|database|frontend|backend|react|node|javascript|python|sql|bug|performance|user|team|client|system|feature|testing|deploy)\b/i.test(answer) || /\d/.test(answer);

    const clarity = clampScore(wordCount >= 35 ? 72 : wordCount >= 18 ? 55 : 35);
    const technicalDepth = clampScore((hasSpecifics ? 68 : 42) + (wordCount >= 45 ? 10 : 0));
    const useOfExamples = clampScore((hasExample ? 70 : 35) + (wordCount >= 45 ? 8 : 0));
    const confidence = clampScore(wordCount >= 25 ? 68 : 42);
    const overallScore = Math.round((clarity + technicalDepth + useOfExamples + confidence) / 4);

    return {
        overallScore,
        summary: overallScore >= 65
            ? "Good attempt. The answer has some usable detail, but it can still be sharper and more specific."
            : "The answer is too light. It needs clearer structure, stronger detail, and a concrete example.",
        subScores: { clarity, technicalDepth, useOfExamples, confidence },
        strengths: overallScore >= 60 ? ["Some relevant explanation was provided."] : ["No strong evidence yet."],
        weaknesses: [
            hasSpecifics ? "The answer could connect the details more clearly to the question." : "The answer lacks concrete technical or role-specific detail.",
            hasExample ? "The example needs clearer outcome or impact." : "No clear example was provided."
        ],
        improvements: [
            "Answer with a short situation, your action, and the result.",
            "Add one specific project, tool, metric, or decision.",
            "Explain why your approach was effective."
        ],
        questionReviews: [{
            question: typeof question === "object" && question !== null ? sanitizeText(question.question) : sanitizeText(question),
            answer,
            score: overallScore,
            strength: overallScore >= 60 ? "Some relevant explanation was provided." : "No strong evidence yet.",
            weakness: hasSpecifics ? "The answer needs clearer structure and impact." : "The answer lacks concrete detail.",
            improve: "Use a specific example and explain the result."
        }]
    };
}

async function answerCandidateQuestion({ jobRole, resumeText, question, answerText }) {
    const currentQuestion = typeof question === "object" && question !== null
        ? sanitizeText(question.question)
        : sanitizeText(question);
    const candidateQuestion = sanitizeText(answerText);

    const prompt = `
You are the interviewer for a ${jobRole} mock interview.

Current interview question:
"${currentQuestion}"

Candidate asked:
"${candidateQuestion}"

Resume/context:
${resumeText}

Answer the candidate's question briefly and helpfully.
Do not ask a new interview question.
End by inviting them to answer the current question when ready.

Return only valid JSON:
{
  "answer": "Your brief clarification",
  "keepQuestion": true
}`;

    const raw = await callGroq(prompt, "You are a helpful interviewer. Clarify, do not advance the interview.");
    const parsed = parseJsonObject(raw);

    return {
        answer: sanitizeText(parsed.answer || "Good question. I am asking what I would like you to cover in your answer. Take a moment, then answer the current question when you are ready."),
        keepQuestion: true
    };
}

async function decideFollowUp() { return { needsFollowUp: false, followUpQuestion: null }; }

async function handleJokeTurn({ answerText }) { return { acknowledgement: "Nice one! Moving on.", isJokeTurn: false, moveToNext: true }; }


// ==========================================
// 5. UTILITY FUNCTIONS
// ==========================================
async function callGroq(prompt, system = "") {
    if (!groq) throw new Error("Groq not initialized");
    const messages = system ? [{ role: "system", content: system }] : [];
    messages.push({ role: "user", content: prompt });

    const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages,
        temperature: 0.72,
        max_completion_tokens: 1000
    });
    return completion?.choices?.[0]?.message?.content || "";
}

function parseJsonObject(text) {
    try {
        let clean = text.replace(/```json|```/g, "").trim();
        const start = clean.indexOf("{");
        const end = clean.lastIndexOf("}");
        if (start !== -1 && end !== -1) clean = clean.slice(start, end + 1);
        return JSON.parse(clean);
    } catch (e) {
        console.error("JSON parse failed");
        return {};
    }
}

function sanitizeText(value) { return String(value || "").replace(/[*_`#]/g, "").replace(/\s+/g, " ").trim(); }

function isNonAnswer(value = "") {
    const text = sanitizeText(value).toLowerCase();
    if (!text) return true;
    const compact = text.replace(/['’]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    const nonAnswerPatterns = [
        /^(i\s*)?(do\s*not|don't|dont)\s+know\b/, /\bno\s+idea\b/, /^no\s+idea\b/, /^not\s+sure\b/, /\bnot\s+sure\b/,
        /^i\s+am\s+not\s+sure\b/, /^i\s+dont\s+remember\b/, /^i\s+cant\s+answer\b/, /^i\s+can't\s+answer\b/,
        /^skip\b/, /^pass\b/, /^nothing\b/, /^no\b/, /^idk\b/
    ];
    const wordCount = compact.split(/\s+/).filter(Boolean).length;
    return nonAnswerPatterns.some((pattern) => pattern.test(compact)) || wordCount <= 2;
}

function buildNonAnswerFeedback(question, answerText) {
    const currentQuestion = typeof question === "object" && question !== null ? sanitizeText(question.question) : sanitizeText(question);
    const answer = sanitizeText(answerText);
    return {
        overallScore: 0, noScore: true,
        summary: "No score was awarded because the answer did not provide enough information to evaluate.",
        subScores: { clarity: 0, technicalDepth: 0, useOfExamples: 0, confidence: 0 },
        strengths: ["No notable strengths in this response."],
        weaknesses: ["The response was a non-answer, so there is no evidence to evaluate."],
        improvements: [
            "Give at least a short answer, even if you are unsure.",
            "Explain what you know, what you would check, and how you would approach the problem.",
            "Use one relevant example from a project, class, or previous work."
        ],
        questionReviews: [{
            question: currentQuestion, answer, score: 0, noScore: true, strength: "No notable strength.",
            weakness: "The answer did not provide evaluable content.", improve: "Give a short structured response instead of saying you do not know."
        }]
    };
}

function clampScore(value) { return Math.max(0, Math.min(100, Math.round(Number(value) || 0))); }

function normalizeQuestionForComparison(text = "") { return sanitizeText(text).toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim(); }

function getFallbackQuestion(questionType, questionNumber, previousQuestions = []) {
    const technicalFallbacks = [
        "Describe a technical decision you made recently and the trade-offs you considered.",
        "Walk me through how you would debug a slow or unreliable feature in production.",
        "Tell me about a project where you improved performance, reliability, or maintainability.",
        "Explain a complex concept from your recent work as if you were onboarding a teammate.",
        "Describe a time you had to choose between two implementation approaches."
    ];
    const hrFallbacks = [
        "Tell me about a time you handled conflicting priorities.",
        "Describe a situation where you received difficult feedback and how you responded.",
        "What kind of team environment helps you do your best work?",
        "Tell me about a time you took ownership beyond your assigned task.",
        "Describe a recent failure or setback and what you learned from it."
    ];
    const pool = questionType === "hr" ? hrFallbacks : technicalFallbacks;
    const used = new Set(previousQuestions.map(normalizeQuestionForComparison));
    const offset = Math.max(0, Number(questionNumber) - 1);
    const rotated = [...pool.slice(offset % pool.length), ...pool.slice(0, offset % pool.length)];
    return rotated.find((question) => !used.has(normalizeQuestionForComparison(question))) || `${pool[offset % pool.length]} Please use a different example than before.`;
}

function getOpeningQuestion(questionType, resumeSignals = {}) {
    if (questionType === "hr") return "Give me a quick introduction and tell me what kind of role you are looking for next.";
    const candidateName = resumeSignals.candidateName && resumeSignals.candidateName !== "Candidate" ? `, ${resumeSignals.candidateName}` : "";
    return `To start${candidateName}, tell me about one recent project you worked on and the technical choices you made.`;
}

function isHobbyJokeQuestion(text = "") { return /joke|tell.*joke|prove.*humor/i.test(sanitizeText(text)); }
function normalizeMode(mode) { return ["technical","hr","mixed"].includes(mode) ? mode : "technical"; }
function normalizeQuestionType(qType, mode, qNum = 1) {
    if (qType === "hr" || qType === "technical") return qType;
    if (mode === "hr" || (mode === "mixed" && Number(qNum) > 5)) return "hr";
    return "technical";
}
function analyzeResumeSignals(text = "", fileName = "", hobbies = []) { return { candidateName: "Candidate", hobbies: hobbies.slice(0, 3) }; }
function chooseSpecialHrQuestion() { return null; }

// ==========================================
// 6. SERVER STARTUP (Only ONE app.listen!)
// ==========================================
app.listen(3000, () => {
    console.log("✅ Server running on http://localhost:3000");
});
