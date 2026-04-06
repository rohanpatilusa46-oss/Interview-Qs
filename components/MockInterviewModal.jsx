'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const DURATIONS = [5, 10, 20];
const MODES = ['Conceptual', 'System Design', 'Mixed'];

function formatDuration(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function toPlainFeedback(evaluation) {
  if (!evaluation) return '';
  const positives = (evaluation.whatCorrect || []).slice(0, 2).join('. ');
  const gaps = (evaluation.whatMissing || []).slice(0, 2).join('. ');
  const improvements = (evaluation.improve || []).slice(0, 2).join('. ');
  return [
    `Score ${evaluation.score}/10.`,
    positives ? `Correct: ${positives}.` : '',
    gaps ? `Missing: ${gaps}.` : '',
    improvements ? `Improve by: ${improvements}.` : '',
  ].filter(Boolean).join(' ');
}

export default function MockInterviewModal({
  open,
  onClose,
  subsection,
  topic,
}) {
  const [difficulty, setDifficulty] = useState('Medium');
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [mode, setMode] = useState('Mixed');

  const [sessionId, setSessionId] = useState('');
  const [sessionSnapshot, setSessionSnapshot] = useState(null);
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState('ASK_QUESTION');
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [draftAnswer, setDraftAnswer] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [summary, setSummary] = useState(null);
  const [questionProgress, setQuestionProgress] = useState({ current: 1, max: 1 });
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micError, setMicError] = useState('');
  const [supportsRecognition, setSupportsRecognition] = useState(false);
  const [isRecordingFallback, setIsRecordingFallback] = useState(false);

  const recognitionRef = useRef(null);
  const recognitionSupportedRef = useRef(false);
  const speechSynthRef = useRef(null);
  const speechUtteranceRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    if (!open) return;

    const SpeechRecognition = typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;

    recognitionSupportedRef.current = !!SpeechRecognition;
    setSupportsRecognition(!!SpeechRecognition);

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      setDraftAnswer(text);
    };

    recognition.onerror = (event) => {
      setMicError(`Mic error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    speechSynthRef.current = window.speechSynthesis;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (remainingSeconds <= 0 || !started || summary) return;

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [open, remainingSeconds, started, summary]);

  useEffect(() => {
    if (remainingSeconds > 0 || !started || !sessionId || summary || !open) return;
    setSummary((prev) => prev || {
      averageScore: evaluation?.score || 0,
      strongAreas: evaluation?.strongAreas || [],
      weakAreas: evaluation?.weakAreas || [],
      recommendedTopics: [`Review ${subsection}`],
      totalQuestions: questionProgress.current,
    });
    setPhase('END');
  }, [remainingSeconds, started, sessionId, summary, evaluation, subsection, questionProgress, open]);

  const title = useMemo(() => subsection || topic || 'Selected subsection', [subsection, topic]);

  function pushTranscript(entry) {
    setTranscript((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, ...entry }]);
  }

  function stopSpeaking() {
    if (!speechSynthRef.current) return;
    speechSynthRef.current.cancel();
    setIsSpeaking(false);
  }

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }

  async function speakText(text, options = {}) {
    if (!text) return;

    stopSpeaking();
    setIsThinking(true);
    await new Promise((resolve) => window.setTimeout(resolve, options.delayMs ?? 500));
    setIsThinking(false);

    if (!speechSynthRef.current) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      if (options.autoListenAfter) {
        startListening();
      }
    };
    utterance.onerror = () => setIsSpeaking(false);

    speechUtteranceRef.current = utterance;
    speechSynthRef.current.speak(utterance);
  }

  async function startListening() {
    if (isSpeaking) {
      stopSpeaking();
    }

    setMicError('');

    if (recognitionSupportedRef.current && recognitionRef.current) {
      try {
        setDraftAnswer('');
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        setMicError('Unable to start speech recognition.');
      }
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMicError('No speech recognition available. Use typed answer fallback.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;

        if (!blob.size) return;

        const formData = new FormData();
        formData.append('audio', blob, 'answer.webm');

        try {
          const response = await fetch('/api/mock/transcribe', {
            method: 'POST',
            body: formData,
          });
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload?.error?.message || 'Transcription failed.');
          }
          setDraftAnswer(payload?.text || '');
        } catch (error) {
          setMicError(error.message);
        }
      };

      recorder.start();
      setIsRecordingFallback(true);
    } catch (error) {
      setMicError(error.message || 'Mic permission denied.');
    }
  }

  function stopFallbackRecording() {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    mediaRecorderRef.current.stop();
    setIsRecordingFallback(false);
  }

  async function startInterview() {
    if (!title) return;

    setIsLoading(true);
    setMicError('');
    try {
      const response = await fetch('/api/mock/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subsection: title,
          topic,
          difficulty,
          durationMinutes,
          mode,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message || `HTTP ${response.status}`);
      }

      setSessionId(payload.sessionId);
      setSessionSnapshot(payload.sessionSnapshot || null);
      setStarted(true);
      setPhase(payload.state || 'ASK_QUESTION');
      setCurrentQuestion(payload.question || '');
      setRemainingSeconds(Math.floor((payload.remainingMs || durationMinutes * 60 * 1000) / 1000));
      setQuestionProgress({ current: 1, max: payload.maxQuestions || 1 });
      setTranscript([{ id: `${Date.now()}-question`, role: 'assistant', type: 'question', content: payload.question }]);

      await speakText(payload.question, { autoListenAfter: true, delayMs: 700 });
    } catch (error) {
      setMicError(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function submitAnswer() {
    const answerText = draftAnswer.trim();
    if (!answerText || !sessionId) return;

    stopListening();
    stopFallbackRecording();

    if (/^repeat question$/i.test(answerText) || /^repeat$/i.test(answerText)) {
      await repeatQuestion();
      setDraftAnswer('');
      return;
    }

    setIsLoading(true);
    setMicError('');

    try {
      pushTranscript({ role: 'user', type: 'answer', content: answerText });

      const response = await fetch('/api/mock/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, answerText, sessionSnapshot }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message || `HTTP ${response.status}`);
      }

      setEvaluation(payload.evaluation || null);
      setSessionSnapshot(payload.sessionSnapshot || sessionSnapshot);
      setDraftAnswer('');

      if (payload.state === 'END') {
        setPhase('END');
        setSummary(payload.summary || null);
        const finalSpeech = [
          payload.feedbackSpeech,
          `Interview complete. Average score ${payload.summary?.averageScore ?? 0} out of 10.`,
        ].filter(Boolean).join(' ');
        pushTranscript({ role: 'assistant', type: 'summary', content: finalSpeech });
        await speakText(finalSpeech, { delayMs: 600 });
        return;
      }

      const feedbackText = payload.feedbackSpeech || toPlainFeedback(payload.evaluation);
      const nextQuestion = payload.nextQuestion || '';
      setPhase(payload.state || 'ASK_QUESTION');
      setCurrentQuestion(nextQuestion);
      setQuestionProgress({ current: payload.questionNumber || questionProgress.current + 1, max: payload.maxQuestions || questionProgress.max });
      setRemainingSeconds(Math.floor((payload.remainingMs || remainingSeconds * 1000) / 1000));

      if (feedbackText) {
        pushTranscript({ role: 'assistant', type: 'feedback', content: feedbackText });
      }
      if (nextQuestion) {
        pushTranscript({ role: 'assistant', type: 'question', content: nextQuestion });
      }

      await speakText([feedbackText, nextQuestion].filter(Boolean).join(' '), {
        autoListenAfter: true,
        delayMs: 800,
      });
    } catch (error) {
      setMicError(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function repeatQuestion() {
    if (!sessionId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/mock/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action: 'repeat', sessionSnapshot }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message || `HTTP ${response.status}`);
      }

      if (payload.question) {
        setSessionSnapshot(payload.sessionSnapshot || sessionSnapshot);
        setCurrentQuestion(payload.question);
        pushTranscript({ role: 'assistant', type: 'question', content: payload.question });
        await speakText(payload.question, { autoListenAfter: true, delayMs: 400 });
      }
    } catch (error) {
      setMicError(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function closeModal() {
    stopSpeaking();
    stopListening();
    stopFallbackRecording();
    setStarted(false);
    setSessionId('');
    setSessionSnapshot(null);
    setSummary(null);
    setEvaluation(null);
    setTranscript([]);
    setDraftAnswer('');
    onClose();
  }

  if (!open) return null;

  return (
    <div className="mock-overlay" onClick={closeModal}>
      <div className="mock-modal card" onClick={(event) => event.stopPropagation()}>
        <div className="mock-head">
          <div>
            <div className="section-label">Voice Mock Interview</div>
            <h2>{title}</h2>
          </div>
          <button className="ghost-btn" onClick={closeModal}>Close</button>
        </div>

        {!started ? (
          <div className="mock-setup">
            <label>
              <span>Difficulty</span>
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                {DIFFICULTIES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Duration</span>
              <select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}>
                {DURATIONS.map((value) => <option key={value} value={value}>{value} min</option>)}
              </select>
            </label>
            <label>
              <span>Mode</span>
              <select value={mode} onChange={(event) => setMode(event.target.value)}>
                {MODES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>

            <button className="primary-btn" onClick={startInterview} disabled={isLoading}>
              {isLoading ? 'Preparing interview…' : 'Start Mock Interview'}
            </button>
            <p className="mock-note">The interview is strictly scoped to this subsection.</p>
          </div>
        ) : (
          <div className="mock-session">
            <div className="mock-status-row">
              <span>State: {phase}</span>
              <span>Question {questionProgress.current}/{questionProgress.max}</span>
              <span>Time left: {formatDuration(remainingSeconds)}</span>
            </div>

            {isThinking && <div className="mock-thinking">Thinking…</div>}

            <div className="mock-question-block">
              <div className="section-label">Current question</div>
              <p>{currentQuestion}</p>
            </div>

            {evaluation && !summary && (
              <div className="mock-eval-card">
                <div className="mock-score">Score: {evaluation.score}/10</div>
                <div className="mock-eval-grid">
                  <div>
                    <strong>Correct</strong>
                    <ul>{(evaluation.whatCorrect || []).map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                  <div>
                    <strong>Missing</strong>
                    <ul>{(evaluation.whatMissing || []).map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                </div>
              </div>
            )}

            {!summary ? (
              <>
                <div className="mock-answer-box">
                  <textarea
                    value={draftAnswer}
                    onChange={(event) => setDraftAnswer(event.target.value)}
                    placeholder="Speak your answer or type here..."
                    rows={4}
                  />
                </div>

                <div className="mock-actions">
                  <button className="ghost-btn" onClick={startListening} disabled={isListening || isRecordingFallback || isLoading}>
                    {supportsRecognition ? (isListening ? 'Listening…' : 'Start voice input') : (isRecordingFallback ? 'Recording…' : 'Record answer')}
                  </button>
                  {!supportsRecognition && isRecordingFallback && (
                    <button className="ghost-btn" onClick={stopFallbackRecording}>Stop recording</button>
                  )}
                  <button className="ghost-btn" onClick={repeatQuestion} disabled={isLoading}>Repeat question</button>
                  <button className="ghost-btn" onClick={stopSpeaking} disabled={!isSpeaking}>Interrupt AI</button>
                  <button className="primary-btn" onClick={submitAnswer} disabled={isLoading || !draftAnswer.trim()}>
                    Submit Answer
                  </button>
                </div>
              </>
            ) : (
              <div className="mock-summary-card">
                <h3>Interview Summary</h3>
                <p>Average score: {summary.averageScore}/10</p>
                <div className="mock-summary-grid">
                  <div>
                    <strong>Strong areas</strong>
                    <ul>{(summary.strongAreas || []).map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                  <div>
                    <strong>Weak areas</strong>
                    <ul>{(summary.weakAreas || []).map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                </div>
                <div>
                  <strong>Recommended topics</strong>
                  <ul>{(summary.recommendedTopics || []).map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              </div>
            )}

            <div className="mock-transcript">
              <div className="section-label">Transcript</div>
              <div className="mock-transcript-list">
                {transcript.map((entry) => (
                  <div key={entry.id} className={`mock-line ${entry.role}`}>
                    <span>{entry.role === 'assistant' ? 'AI' : 'You'}</span>
                    <p>{entry.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {micError && <div className="mock-error">{micError}</div>}
      </div>
    </div>
  );
}
