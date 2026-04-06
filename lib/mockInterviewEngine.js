import { randomUUID } from 'crypto';
import { callOllamaChat, callOpenAIChat, parseJsonFromLLM } from './llmRouter';
import { evaluationPrompt, followUpPrompt, questionGeneratorPrompt } from './mockPrompts';

const SessionState = {
  ASK_QUESTION: 'ASK_QUESTION',
  LISTEN: 'LISTEN',
  EVALUATE: 'EVALUATE',
  FOLLOW_UP: 'FOLLOW_UP',
  END: 'END',
};

const sessions = new Map();

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(10, Math.round(numeric)));
}

function getMaxQuestions(durationMinutes) {
  if (durationMinutes <= 5) return 3;
  if (durationMinutes <= 10) return 6;
  return 10;
}

function sanitizeArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function normalizeAnswers(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isObject(item)) return null;
      return {
        question: String(item.question || ''),
        answer: String(item.answer || ''),
        evaluation: isObject(item.evaluation)
          ? {
              score: clampScore(item.evaluation.score),
              whatCorrect: sanitizeArray(item.evaluation.whatCorrect),
              whatMissing: sanitizeArray(item.evaluation.whatMissing),
              improve: sanitizeArray(item.evaluation.improve),
              idealAnswer: String(item.evaluation.idealAnswer || ''),
              strongAreas: sanitizeArray(item.evaluation.strongAreas),
              weakAreas: sanitizeArray(item.evaluation.weakAreas),
            }
          : {
              score: 0,
              whatCorrect: [],
              whatMissing: [],
              improve: [],
              idealAnswer: '',
              strongAreas: [],
              weakAreas: [],
            },
        timestamp: Number(item.timestamp) || Date.now(),
      };
    })
    .filter(Boolean);
}

function normalizeTranscript(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isObject(item)) return null;
      return {
        role: String(item.role || 'assistant'),
        type: String(item.type || 'note'),
        content: String(item.content || ''),
        timestamp: Number(item.timestamp) || Date.now(),
      };
    })
    .filter(Boolean);
}

function createSessionSnapshot(session) {
  return {
    id: session.id,
    topic: session.topic,
    subsection: session.subsection,
    difficulty: session.difficulty,
    mode: session.mode,
    durationMinutes: session.durationMinutes,
    startedAt: session.startedAt,
    endsAt: session.endsAt,
    maxQuestions: session.maxQuestions,
    questionCount: session.questionCount,
    currentQuestion: session.currentQuestion,
    state: session.state,
    answers: session.answers,
    transcript: session.transcript,
    updatedAt: Date.now(),
    v: 1,
  };
}

function restoreSessionFromSnapshot(sessionId, snapshot) {
  if (!isObject(snapshot)) return null;
  if (String(snapshot.id || '').trim() !== String(sessionId || '').trim()) return null;

  const restored = {
    id: String(snapshot.id || sessionId),
    topic: String(snapshot.topic || snapshot.subsection || 'General').trim(),
    subsection: String(snapshot.subsection || snapshot.topic || 'General').trim(),
    difficulty: String(snapshot.difficulty || 'Medium'),
    mode: String(snapshot.mode || 'Mixed'),
    durationMinutes: Number(snapshot.durationMinutes) || 10,
    startedAt: Number(snapshot.startedAt) || Date.now(),
    endsAt: Number(snapshot.endsAt) || (Date.now() + 10 * 60 * 1000),
    maxQuestions: Number(snapshot.maxQuestions) || getMaxQuestions(Number(snapshot.durationMinutes) || 10),
    questionCount: Number(snapshot.questionCount) || 1,
    currentQuestion: String(snapshot.currentQuestion || ''),
    state: String(snapshot.state || SessionState.LISTEN),
    answers: normalizeAnswers(snapshot.answers),
    transcript: normalizeTranscript(snapshot.transcript),
  };

  sessions.set(restored.id, restored);
  return restored;
}

function getSession(sessionId, snapshot) {
  const existing = sessions.get(sessionId);
  if (existing) return existing;
  return restoreSessionFromSnapshot(sessionId, snapshot);
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (session.endsAt + 30 * 60 * 1000 < now) {
      sessions.delete(sessionId);
    }
  }
}

async function generateScopedQuestion(session) {
  const prompt = questionGeneratorPrompt({
    difficulty: session.difficulty,
    subsection: session.subsection,
    mode: session.mode,
  });

  try {
    const fromOllama = await callOllamaChat({ prompt });
    if (fromOllama) return fromOllama;
  } catch {
    // Fall back to OpenAI if Ollama is unavailable.
  }

  const fromOpenAI = await callOpenAIChat({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
    maxTokens: 180,
  });

  return fromOpenAI || `Explain the key trade-offs in ${session.subsection}.`;
}

async function evaluateCandidateAnswer(session, answerText) {
  const question = session.currentQuestion || 'No question captured.';
  const prompt = evaluationPrompt({
    difficulty: session.difficulty,
    subsection: session.subsection,
    question,
    answerText,
  });

  const raw = await callOpenAIChat({
    model: process.env.OPENAI_EVAL_MODEL || 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    maxTokens: 700,
  });

  const parsed = parseJsonFromLLM(raw, {});

  return {
    score: clampScore(parsed.score),
    whatCorrect: sanitizeArray(parsed.whatCorrect),
    whatMissing: sanitizeArray(parsed.whatMissing),
    improve: sanitizeArray(parsed.improve),
    idealAnswer: String(parsed.idealAnswer || '').trim(),
    strongAreas: sanitizeArray(parsed.strongAreas),
    weakAreas: sanitizeArray(parsed.weakAreas),
  };
}

async function generateFollowUpQuestion(session, answerText, weakAreas) {
  const prompt = followUpPrompt({
    difficulty: session.difficulty,
    subsection: session.subsection,
    question: session.currentQuestion,
    answerText,
    weakAreas,
  });

  const raw = await callOpenAIChat({
    model: process.env.OPENAI_EVAL_MODEL || 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
    maxTokens: 180,
  });

  return raw || `Can you go deeper on ${session.subsection}?`;
}

function buildSummary(session) {
  const attempts = session.answers.length;
  const averageScore = attempts
    ? Number((session.answers.reduce((sum, item) => sum + item.evaluation.score, 0) / attempts).toFixed(1))
    : 0;

  const weakAreas = [...new Set(session.answers.flatMap((item) => item.evaluation.weakAreas))].slice(0, 8);
  const strongAreas = [...new Set(session.answers.flatMap((item) => item.evaluation.strongAreas))].slice(0, 8);
  const recommendedTopics = weakAreas.length
    ? weakAreas.map((item) => `${session.subsection}: ${item}`)
    : [`Review trade-offs and implementation details in ${session.subsection}`];

  return {
    averageScore,
    strongAreas,
    weakAreas,
    recommendedTopics,
    totalQuestions: session.questionCount,
  };
}

function formatFeedbackForSpeech(evaluation) {
  const positives = evaluation.whatCorrect.slice(0, 2).join('. ');
  const gaps = evaluation.whatMissing.slice(0, 2).join('. ');
  return [
    `Score: ${evaluation.score} out of 10.`,
    positives ? `You did well on: ${positives}.` : '',
    gaps ? `Missing points: ${gaps}.` : '',
  ].filter(Boolean).join(' ');
}

export async function startInterview({ subsection, topic, difficulty, durationMinutes, mode }) {
  cleanupExpiredSessions();

  const normalizedDuration = Number(durationMinutes) || 10;
  const sessionId = randomUUID();
  const now = Date.now();

  const session = {
    id: sessionId,
    topic: String(topic || subsection || 'General').trim(),
    subsection: String(subsection || topic || 'General').trim(),
    difficulty: String(difficulty || 'Medium'),
    mode: String(mode || 'Mixed'),
    durationMinutes: normalizedDuration,
    startedAt: now,
    endsAt: now + normalizedDuration * 60 * 1000,
    maxQuestions: getMaxQuestions(normalizedDuration),
    questionCount: 0,
    currentQuestion: '',
    state: SessionState.ASK_QUESTION,
    answers: [],
    transcript: [],
  };

  const question = await generateScopedQuestion(session);
  session.currentQuestion = question;
  session.questionCount = 1;
  session.state = SessionState.LISTEN;
  session.transcript.push({ role: 'assistant', type: 'question', content: question, timestamp: Date.now() });

  sessions.set(sessionId, session);

  return {
    sessionId,
    state: SessionState.ASK_QUESTION,
    question,
    subsection: session.subsection,
    topic: session.topic,
    difficulty: session.difficulty,
    mode: session.mode,
    startedAt: session.startedAt,
    endsAt: session.endsAt,
    maxQuestions: session.maxQuestions,
    sessionSnapshot: createSessionSnapshot(session),
  };
}

export async function submitInterviewAnswer({ sessionId, answerText, sessionSnapshot }) {
  cleanupExpiredSessions();

  const session = getSession(sessionId, sessionSnapshot);
  if (!session) {
    throw new Error('Interview session not found or expired.');
  }

  if (session.state === SessionState.END) {
    return {
      sessionId,
      state: SessionState.END,
      summary: buildSummary(session),
      sessionSnapshot: createSessionSnapshot(session),
    };
  }

  const candidateAnswer = String(answerText || '').trim();
  if (!candidateAnswer) {
    throw new Error('Answer text is required.');
  }

  session.state = SessionState.EVALUATE;
  session.transcript.push({ role: 'user', type: 'answer', content: candidateAnswer, timestamp: Date.now() });

  const evaluation = await evaluateCandidateAnswer(session, candidateAnswer);

  session.answers.push({
    question: session.currentQuestion,
    answer: candidateAnswer,
    evaluation,
    timestamp: Date.now(),
  });

  const timedOut = Date.now() >= session.endsAt;
  const reachedLimit = session.questionCount >= session.maxQuestions;

  if (timedOut || reachedLimit) {
    session.state = SessionState.END;
    const summary = buildSummary(session);
    return {
      sessionId,
      state: SessionState.END,
      evaluation,
      feedbackSpeech: formatFeedbackForSpeech(evaluation),
      summary,
      sessionSnapshot: createSessionSnapshot(session),
    };
  }

  const shouldFollowUp = evaluation.score < 7;
  const nextQuestion = shouldFollowUp
    ? await generateFollowUpQuestion(session, candidateAnswer, evaluation.weakAreas)
    : await generateScopedQuestion(session);

  session.currentQuestion = nextQuestion;
  session.questionCount += 1;
  session.state = SessionState.LISTEN;
  session.transcript.push({ role: 'assistant', type: shouldFollowUp ? 'followup' : 'question', content: nextQuestion, timestamp: Date.now() });

  return {
    sessionId,
    state: shouldFollowUp ? SessionState.FOLLOW_UP : SessionState.ASK_QUESTION,
    evaluation,
    feedbackSpeech: formatFeedbackForSpeech(evaluation),
    nextQuestion,
    questionNumber: session.questionCount,
    maxQuestions: session.maxQuestions,
    remainingMs: Math.max(0, session.endsAt - Date.now()),
    sessionSnapshot: createSessionSnapshot(session),
  };
}

export async function getNextInterviewStep({ sessionId, action = 'repeat', sessionSnapshot }) {
  cleanupExpiredSessions();

  const session = getSession(sessionId, sessionSnapshot);
  if (!session) {
    throw new Error('Interview session not found or expired.');
  }

  if (session.state === SessionState.END) {
    return {
      sessionId,
      state: SessionState.END,
      summary: buildSummary(session),
      sessionSnapshot: createSessionSnapshot(session),
    };
  }

  if (action === 'skip') {
    const nextQuestion = await generateScopedQuestion(session);
    session.currentQuestion = nextQuestion;
    session.questionCount += 1;
    session.transcript.push({ role: 'assistant', type: 'question', content: nextQuestion, timestamp: Date.now() });

    return {
      sessionId,
      state: SessionState.ASK_QUESTION,
      question: nextQuestion,
      questionNumber: session.questionCount,
      maxQuestions: session.maxQuestions,
      remainingMs: Math.max(0, session.endsAt - Date.now()),
      sessionSnapshot: createSessionSnapshot(session),
    };
  }

  return {
    sessionId,
    state: SessionState.ASK_QUESTION,
    question: session.currentQuestion,
    questionNumber: session.questionCount,
    maxQuestions: session.maxQuestions,
    remainingMs: Math.max(0, session.endsAt - Date.now()),
    sessionSnapshot: createSessionSnapshot(session),
  };
}
