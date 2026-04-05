'use client';

import { useEffect, useMemo, useState } from 'react';
import { data } from '../lib/data';

const STORAGE_KEYS = {
  bookmarks: 'mlprep.bookmarks',
  conversations: 'mlprep.conversations',
  quizCache: 'mlprep.quizCache',
  uiMode: 'mlprep.uiMode',
};

const SUGGESTED = {
  default: ['Explain like I\'m 5', 'Interview question on this', 'Code example', 'Compare to alternatives', 'Common pitfalls'],
  'KV cache mechanics': ['How does paged attention work?', 'Memory cost formula?', 'GQA vs MQA impact?'],
  Backpropagation: ['Derive the gradient step by step', 'Vanishing gradient connection?', 'Computational graph example?'],
  Transformer: ['Attention complexity?', 'Encoder vs decoder?', 'Why layer norm before attention?'],
};

function loadStoredJSON(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function buildTopicIndex() {
  const index = {};
  data.forEach((domain) => {
    domain.sections.forEach((section) => {
      section.tags.forEach((tag) => {
        index[tag] = domain.name;
      });
    });
  });
  return index;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value) {
  return value.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

function markdownToHtml(md) {
  let html = md
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => `<pre><code class="lang-${lang}">${escapeHtml(code.trim())}</code></pre>`)
    .replace(/`([^`]+)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`)
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^[*\-] (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  return html
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (trimmed.match(/^<(h[123]|ul|ol|pre|blockquote)/)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
}

function normalizeQuizResponse(reply) {
  const cleaned = reply.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0]);
    throw new Error('Quiz response was not valid JSON.');
  }
}

function normalizeQuizItems(payload) {
  const source = Array.isArray(payload) ? payload : (payload?.questions || []);
  return source
    .map((item, index) => {
      const question = String(item?.question || '').trim();
      const options = Array.isArray(item?.options)
        ? item.options.map((option) => String(option || '').trim()).filter(Boolean)
        : [];

      const normalizedOptions = [...options];
      while (normalizedOptions.length < 4) {
        normalizedOptions.push(`Option ${normalizedOptions.length + 1}`);
      }

      let answerIndex = Number(item?.answerIndex);
      if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
        const answerText = String(item?.answer || item?.correctOption || '').trim();
        answerIndex = normalizedOptions.findIndex((option) => option === answerText);
        if (answerIndex < 0) answerIndex = 0;
      }

      const explanation = String(item?.explanation || item?.answerExplanation || '').trim();

      if (!question) return null;
      return {
        id: `q-${index}`,
        question,
        options: normalizedOptions.slice(0, 4),
        answerIndex,
        explanation,
      };
    })
    .filter(Boolean);
}

export default function Page() {
  const topicIndex = useMemo(() => buildTopicIndex(), []);
  const topicsByDomain = useMemo(() => {
    const map = {};
    data.forEach((domain) => {
      map[domain.name] = domain.sections.flatMap((section) => section.tags);
    });
    return map;
  }, []);

  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentView, setCurrentView] = useState('learn');
  const [libraryTab, setLibraryTab] = useState('bookmarks');
  const [bookmarks, setBookmarks] = useState([]);
  const [conversations, setConversations] = useState({});
  const [quizCache, setQuizCache] = useState({});
  const [currentQuiz, setCurrentQuiz] = useState([]);
  const [quizStep, setQuizStep] = useState(0);
  const [quizSelections, setQuizSelections] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState({});
  const [quizScore, setQuizScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const [compareResult, setCompareResult] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);

  useEffect(() => {
    setHydrated(true);
    setBookmarks(loadStoredJSON(STORAGE_KEYS.bookmarks, []));
    setConversations(loadStoredJSON(STORAGE_KEYS.conversations, {}));
    setQuizCache(loadStoredJSON(STORAGE_KEYS.quizCache, {}));
    setCurrentView(window.localStorage.getItem(STORAGE_KEYS.uiMode) || 'learn');
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEYS.bookmarks, JSON.stringify(bookmarks));
  }, [bookmarks, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify(conversations));
  }, [conversations, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEYS.quizCache, JSON.stringify(quizCache));
  }, [quizCache, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEYS.uiMode, currentView);
  }, [currentView, hydrated]);

  useEffect(() => {
    if (!selectedTopic || !hydrated) return;
    const saved = conversations[selectedTopic]?.messages || [];
    setMessages(saved);
    setCurrentQuiz(quizCache[selectedTopic] || []);
    setQuizStep(0);
    setQuizSelections({});
    setQuizSubmitted({});
    setQuizScore(0);
    setQuizCompleted(false);
    setCompareA(selectedTopic);
  }, [selectedTopic, conversations, quizCache, hydrated]);

  const filteredDomains = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data
      .map((domain) => {
        const sections = domain.sections
          .map((section) => {
            const tags = section.tags.filter((tag) => !q || tag.toLowerCase().includes(q));
            return tags.length ? { ...section, tags } : null;
          })
          .filter(Boolean);
        return sections.length || !q ? { ...domain, sections } : null;
      })
      .filter(Boolean);
  }, [search]);

  const totalConcepts = useMemo(() => data.reduce((total, domain) => total + domain.sections.reduce((sum, section) => sum + section.tags.length, 0), 0), []);
  const visibleConcepts = useMemo(() => filteredDomains.reduce((total, domain) => total + domain.sections.reduce((sum, section) => sum + section.tags.length, 0), 0), [filteredDomains]);
  const recommendedQuizTopics = useMemo(() => {
    if (!selectedTopic || !selectedDomain) return [];

    const sameDomain = (topicsByDomain[selectedDomain] || []).filter((topic) => topic !== selectedTopic);
    const picks = [...sameDomain.slice(0, 3)];
    if (picks.length >= 3) return picks;

    const fallback = data
      .flatMap((domain) => domain.sections.flatMap((section) => section.tags))
      .filter((topic) => topic !== selectedTopic && !picks.includes(topic));

    return [...picks, ...fallback.slice(0, 3 - picks.length)];
  }, [selectedTopic, selectedDomain, topicsByDomain]);

  function openLibrary(tab = 'bookmarks') {
    setLibraryTab(tab);
    setCurrentView(tab);
    setLibraryOpen(true);
  }

  function closeLibrary() {
    setLibraryOpen(false);
  }

  function resetQuizSession() {
    setQuizStep(0);
    setQuizSelections({});
    setQuizSubmitted({});
    setQuizScore(0);
    setQuizCompleted(false);
  }

  async function callOpenAI(systemPrompt, chatMessages, extra = {}) {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt,
        messages: chatMessages,
        model: extra.model || 'gpt-4o',
        temperature: extra.temperature ?? 0.7,
        max_tokens: extra.max_tokens ?? 1200,
        response_format: extra.response_format,
      }),
    });

    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || `HTTP ${response.status}`);
    return payload.content;
  }

  function saveConversation(topic, nextMessages) {
    setConversations((prev) => ({
      ...prev,
      [topic]: {
        messages: nextMessages.map((message) => ({ role: message.role, content: message.content })),
        updatedAt: Date.now(),
        domain: topicIndex[topic] || selectedDomain,
      },
    }));
  }

  function toggleBookmark(topic = selectedTopic) {
    if (!topic) return;
    const domain = topicIndex[topic] || selectedDomain || '';
    setBookmarks((prev) => {
      const exists = prev.find((entry) => entry.topic === topic);
      if (exists) return prev.filter((entry) => entry.topic !== topic);
      return [{ topic, domain, savedAt: Date.now() }, ...prev];
    });
  }

  function openTopic(topic, domain) {
    setSelectedTopic(topic);
    setSelectedDomain(domain);
    setCurrentView('learn');
    setLibraryOpen(false);
    setChatInput('');
    const saved = conversations[topic]?.messages || [];
    setMessages(saved);
    setCurrentQuiz(quizCache[topic] || []);
    setCompareA(topic);
    if (!saved.length) {
      autoExplain(topic, domain, []);
    }
  }

  async function autoExplain(topic, domain, baseMessages = messages) {
    const systemPrompt = `You are an expert ML/AI interview coach. The user is preparing for a mid-senior ML engineer interview (5 years experience). When explaining a concept: 1. Start with a crisp 1-2 line definition 2. Explain the core intuition 3. Cover math, trade-offs, when to use/avoid 4. Give 1 concrete example or analogy 5. Mention 1-2 gotchas. Use markdown.`;
    const userMsg = `Explain **${topic}** (from the domain: ${domain}) for a mid-senior ML interview. Be thorough but interview-focused.`;

    const optimistic = [...baseMessages, { role: 'user', content: userMsg }];
    setMessages(optimistic);
    saveConversation(topic, optimistic);
    setIsLoading(true);

    try {
      const reply = await callOpenAI(systemPrompt, optimistic);
      const updated = [...optimistic, { role: 'assistant', content: reply }];
      setMessages(updated);
      saveConversation(topic, updated);
    } catch (error) {
      const updated = [...optimistic, { role: 'assistant', content: `Error: ${error.message}` }];
      setMessages(updated);
      saveConversation(topic, updated);
    } finally {
      setIsLoading(false);
    }
  }

  async function sendMessage() {
    const text = chatInput.trim();
    if (!text || isLoading || !selectedTopic) return;

    if (/^generate\s+quiz$/i.test(text) || /^quiz\s+me$/i.test(text)) {
      setChatInput('');
      await generateQuiz();
      return;
    }

    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    saveConversation(selectedTopic, nextMessages);
    setChatInput('');
    setIsLoading(true);

    const systemPrompt = `You are an expert ML/AI interview coach. The user is studying **${selectedTopic}** (domain: ${selectedDomain}) for a mid-senior ML interview. Answer with clarity, depth, markdown, and practical interview focus.`;

    try {
      const reply = await callOpenAI(systemPrompt, nextMessages);
      const updated = [...nextMessages, { role: 'assistant', content: reply }];
      setMessages(updated);
      saveConversation(selectedTopic, updated);
    } catch (error) {
      const updated = [...nextMessages, { role: 'assistant', content: `Error: ${error.message}` }];
      setMessages(updated);
      saveConversation(selectedTopic, updated);
    } finally {
      setIsLoading(false);
    }
  }

  async function generateQuiz(topicArg = selectedTopic, questionCount = 5, domainArg = selectedDomain) {
    if (!topicArg) return;
    const resolvedDomain = domainArg || topicIndex[topicArg] || selectedDomain || '';

    setSelectedTopic(topicArg);
    setSelectedDomain(resolvedDomain);
    openLibrary('quiz');
    resetQuizSession();
    setCurrentQuiz([]);
    setIsLoading(true);

    try {
      const systemPrompt = `You create interview-prep multiple choice quizzes for ML concepts.
Return valid JSON only in this exact shape:
{
  "questions": [
    {
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "answerIndex": 0,
      "explanation": "..."
    }
  ]
}
Rules:
- Exactly ${questionCount} questions.
- Exactly 4 options each.
- One correct option only.
- answerIndex must be 0..3.
- Questions should be interview-focused and non-trivial.`;
      const userMsg = `Create a ${questionCount}-question multiple-choice quiz for the concept "${topicArg}" in domain "${resolvedDomain}".`;
      const reply = await callOpenAI(systemPrompt, [{ role: 'user', content: userMsg }], {
        temperature: 0.2,
        max_tokens: Math.max(1800, questionCount * 320),
      });
      const parsed = normalizeQuizResponse(reply);
      const quiz = normalizeQuizItems(parsed);
      if (!quiz.length) throw new Error('Quiz generation returned no valid questions.');
      setCurrentQuiz(quiz);
      setQuizCache((prev) => ({ ...prev, [topicArg]: quiz }));
    } catch (error) {
      setCurrentQuiz([]);
      setQuizCompleted(false);
      setQuizSelections({});
      setQuizSubmitted({});
      setQuizStep(0);
      setQuizScore(0);
      setCompareResult('');
      alert(`Quiz generation failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  function selectQuizOption(optionIndex) {
    if (quizSubmitted[quizStep]) return;
    setQuizSelections((prev) => ({ ...prev, [quizStep]: optionIndex }));
  }

  function submitQuizAnswer() {
    const quiz = currentQuiz.length ? currentQuiz : (quizCache[selectedTopic] || []);
    const current = quiz[quizStep];
    const selectedOption = quizSelections[quizStep];
    if (!current || selectedOption === undefined) return;
    if (quizSubmitted[quizStep]) return;

    setQuizSubmitted((prev) => ({ ...prev, [quizStep]: true }));
    if (selectedOption === current.answerIndex) {
      setQuizScore((prev) => prev + 1);
    }
  }

  function nextQuizQuestion() {
    const quiz = currentQuiz.length ? currentQuiz : (quizCache[selectedTopic] || []);
    if (quizStep >= quiz.length - 1) {
      setQuizCompleted(true);
      return;
    }
    setQuizStep((prev) => prev + 1);
  }

  async function runComparison() {
    if (!compareA || !compareB || compareA === compareB) {
      setCompareResult('Pick two different concepts to compare.');
      return;
    }
    setIsLoading(true);
    openLibrary('compare');
    try {
      const systemPrompt = 'You are an expert ML interview coach. Compare two ML concepts in a structured way. Use headings and include high-level difference, when to use each, trade-offs, key interview questions, and confusion traps.';
      const userMsg = `Compare **${compareA}** vs **${compareB}** for interview preparation. Keep it concise but deep.`;
      const reply = await callOpenAI(systemPrompt, [{ role: 'user', content: userMsg }], { temperature: 0.5 });
      setCompareResult(reply);
    } catch (error) {
      setCompareResult(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  const bookmarksCount = bookmarks.length;
  const historyCount = Object.values(conversations).filter((conversation) => conversation.messages?.length).length;

  const libraryContent = {
    bookmarks: (
      <div className="library-list">
        {bookmarks.length ? bookmarks.map((entry) => (
          <button className="library-item" key={entry.topic} onClick={() => openTopic(entry.topic, entry.domain)}>
            <span className="library-item-title">{entry.topic}</span>
            <span className="library-item-sub">{entry.domain || topicIndex[entry.topic] || 'Saved concept'}</span>
          </button>
        )) : <div className="empty-state">No bookmarks yet. Save concepts for later review.</div>}
      </div>
    ),
    history: (
      <div className="library-list">
        {Object.entries(conversations)
          .filter(([, convo]) => convo.messages?.length)
          .sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0))
          .map(([topic, convo]) => {
            const preview = [...convo.messages].reverse().find((message) => message.role === 'assistant')?.content || 'Conversation saved.';
            return (
              <button className="library-item" key={topic} onClick={() => openTopic(topic, convo.domain || topicIndex[topic] || '')}>
                <span className="library-item-title">{topic}</span>
                <span className="library-item-sub">{convo.messages.length} messages · {preview.slice(0, 110)}{preview.length > 110 ? '…' : ''}</span>
              </button>
            );
          })}
        {!historyCount && <div className="empty-state">No chat history yet. Open a concept and start asking questions.</div>}
      </div>
    ),
    quiz: (
      <div className="quiz-panel">
        <div className="quiz-header">
          <div>
            <div className="section-label">Quiz mode</div>
            <h2>{selectedTopic || 'Select a concept first'}</h2>
            <p>Practice recall with one MCQ at a time.</p>
          </div>
          <button className="primary-btn" onClick={() => generateQuiz(selectedTopic, 5)} disabled={!selectedTopic || isLoading}>
            {isLoading ? 'Generating…' : 'Generate quiz'}
          </button>
        </div>
        <div className="quiz-list">
          {(() => {
            const quiz = currentQuiz.length ? currentQuiz : (quizCache[selectedTopic] || []);
            if (!quiz.length) {
              return <div className="empty-state">Generate a quiz from the current topic to start.</div>;
            }

            if (quizCompleted) {
              const percentage = Math.round((quizScore / quiz.length) * 100);
              const feedback = percentage >= 85
                ? 'Excellent. You are interview-ready on this topic.'
                : percentage >= 60
                  ? 'Good progress. One more round will strengthen recall.'
                  : 'Keep practicing. Focus on fundamentals and common traps.';

              return (
                <div className="quiz-card quiz-complete-card">
                  <div className="quiz-complete-score">Final score: {quizScore} / {quiz.length} ({percentage}%)</div>
                  <div className="quiz-complete-feedback">{feedback}</div>

                  <div className="quiz-complete-actions">
                    <button className="primary-btn" onClick={() => generateQuiz(selectedTopic, 5)}>Generate 5 more questions</button>
                    <button className="ghost-btn" onClick={() => generateQuiz(selectedTopic, 10)}>10-question challenge</button>
                    <button className="ghost-btn" onClick={resetQuizSession}>Retry this quiz</button>
                  </div>

                  <div className="quiz-recommend-title">Recommended next quiz topics</div>
                  <div className="quiz-recommend-grid">
                    {recommendedQuizTopics.map((topic) => (
                      <button
                        key={topic}
                        className="quiz-recommend-chip"
                        onClick={() => generateQuiz(topic, 5, topicIndex[topic] || '')}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }

            const current = quiz[quizStep];
            const selectedOption = quizSelections[quizStep];
            const submitted = !!quizSubmitted[quizStep];
            const isCorrect = submitted && selectedOption === current.answerIndex;

            return (
              <div className="quiz-card single-quiz-card" key={current.id || `quiz-${quizStep}`}>
                <div className="quiz-progress">Question {quizStep + 1} / {quiz.length} · Score {quizScore}</div>
                <div className="quiz-question">{current.question}</div>
                <div className="quiz-options">
                  {current.options.map((option, optionIndex) => {
                    const isSelected = selectedOption === optionIndex;
                    const isAnswer = current.answerIndex === optionIndex;
                    const classNames = ['quiz-option'];
                    if (isSelected) classNames.push('selected');
                    if (submitted && isAnswer) classNames.push('correct');
                    if (submitted && isSelected && !isAnswer) classNames.push('wrong');

                    return (
                      <button
                        key={`${current.id}-${optionIndex}`}
                        className={classNames.join(' ')}
                        onClick={() => selectQuizOption(optionIndex)}
                        disabled={submitted}
                      >
                        <span className="quiz-option-letter">{String.fromCharCode(65 + optionIndex)}</span>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>

                {!submitted ? (
                  <div className="quiz-actions">
                    <button className="primary-btn" onClick={submitQuizAnswer} disabled={selectedOption === undefined}>Submit answer</button>
                  </div>
                ) : (
                  <div className="quiz-actions">
                    <div className={`quiz-feedback ${isCorrect ? 'ok' : 'bad'}`}>
                      {isCorrect ? 'Correct ✅' : `Not quite. Correct answer: ${String.fromCharCode(65 + current.answerIndex)}`}
                    </div>
                    {current.explanation ? <div className="quiz-explanation">{current.explanation}</div> : null}
                    <button className="primary-btn" onClick={nextQuizQuestion}>
                      {quizStep >= quiz.length - 1 ? 'Finish quiz' : 'Next question'}
                    </button>
                  </div>
                )}

              </div>
            );
          })()}
        </div>
      </div>
    ),
    compare: (
      <div className="compare-panel">
        <div className="compare-grid">
          <label>
            <span>First concept</span>
            <input value={compareA} onChange={(event) => setCompareA(event.target.value)} list="concepts" placeholder="e.g. LoRA" />
          </label>
          <label>
            <span>Second concept</span>
            <input value={compareB} onChange={(event) => setCompareB(event.target.value)} list="concepts" placeholder="e.g. QLoRA" />
          </label>
        </div>
        <div className="compare-actions">
          <button className="primary-btn" onClick={runComparison} disabled={isLoading}>Compare concepts</button>
        </div>
        <div className="compare-output">{compareResult ? <article className="prose" dangerouslySetInnerHTML={{ __html: markdownToHtml(compareResult) }} /> : <div className="empty-state">Choose two concepts and compare them side by side.</div>}</div>
      </div>
    ),
  };

  return (
    <div className="app-shell">
      <datalist id="concepts">
        {data.flatMap((domain) => domain.sections.flatMap((section) => section.tags)).map((topic) => (
          <option value={topic} key={topic} />
        ))}
      </datalist>

      <header className="topbar">
        <div>
          <div className="brand-row">
            <span className="brand-dot" />
            <h1>ML Interview Prep</h1>
          </div>
          <p>Search concepts, drill quizzes, bookmark weak spots, and compare ideas fast.</p>
        </div>
        <div className="topbar-actions">
          <span className="status-pill">API via .env</span>
          <span className="status-pill">{totalConcepts} concepts</span>
          <span className="status-pill">{bookmarksCount} saved</span>
          <span className="status-pill">{historyCount} chats</span>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar card">
          <div className="sidebar-head">
            <div>
              <div className="section-label">Concept browser</div>
              <h2>Explore the curriculum</h2>
            </div>
            <button className="ghost-btn" onClick={() => openLibrary('bookmarks')}>Library</button>
          </div>
          <div className="search-box">
            <span>⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search concepts…" />
          </div>
          <div className="browser-meta">{search ? `${visibleConcepts} / ${totalConcepts} concepts` : `${totalConcepts} concepts`}</div>
          <div className="domain-list">
            {filteredDomains.map((domain) => (
              <details className="domain-card" key={domain.name} open={!search}>
                <summary>
                  <span className="domain-color" style={{ background: domain.color }} />
                  <span>{domain.name}</span>
                  <span className="domain-count">{domain.sections.reduce((sum, section) => sum + section.tags.length, 0)}</span>
                </summary>
                <div className="section-list">
                  {domain.sections.map((section) => (
                    <div className="section-block" key={section.title}>
                      <div className="section-label">{section.title}</div>
                      <div className="tag-cloud">
                        {section.tags.map((tag) => {
                          const active = tag === selectedTopic;
                          return (
                            <button key={tag} className={`tag-chip ${active ? 'active' : ''}`} onClick={() => openTopic(tag, domain.name)}>
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </aside>

        <section className="content card">
          <div className="content-head">
            <div>
              <div className="section-label">Studying</div>
              <h2>{selectedTopic || 'Pick a concept to begin'}</h2>
              <p>{selectedDomain || 'Use the browser on the left to open a topic and get a tailored explanation.'}</p>
            </div>
            <div className="content-actions">
              <button className={`ghost-btn ${bookmarks.find((entry) => entry.topic === selectedTopic) ? 'active' : ''}`} onClick={() => toggleBookmark()} disabled={!selectedTopic}>
                {bookmarks.find((entry) => entry.topic === selectedTopic) ? '★ Bookmarked' : '☆ Bookmark'}
              </button>
              <button className="ghost-btn" onClick={() => openLibrary('bookmarks')} disabled={!selectedTopic && !bookmarks.length && !historyCount}>
                Library
              </button>
              <button className="ghost-btn" onClick={() => openLibrary('quiz')}>Quiz</button>
              <button className="ghost-btn" onClick={() => openLibrary('compare')}>Compare</button>
            </div>
          </div>

          <div className="quick-chips">
            {(SUGGESTED[selectedTopic] || SUGGESTED.default).map((prompt) => (
              <button key={prompt} className="chip" onClick={() => setChatInput(prompt)}>
                {prompt}
              </button>
            ))}
          </div>

          <div className="conversation">
            <div className="messages">
              {!messages.length ? (
                <div className="empty-state hero-empty">
                  <h3>Start with a concept and get a guided explanation.</h3>
                  <p>Then quiz yourself, save it for later, or compare it to a related idea.</p>
                </div>
              ) : messages.map((message, index) => (
                <article key={`${message.role}-${index}`} className={`message ${message.role}`}>
                  <span className="message-role">{message.role === 'user' ? 'you' : 'coach'}</span>
                  <div className="message-body" dangerouslySetInnerHTML={{ __html: markdownToHtml(message.content) }} />
                </article>
              ))}
              {isLoading && <div className="typing-row"><span /><span /><span /></div>}
            </div>
          </div>

          <form
            className="chat-box"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
          >
            <textarea
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder={selectedTopic ? `Ask a follow-up about ${selectedTopic}…` : 'Select a topic to begin…'}
              rows={3}
            />
            <div className="chat-actions">
              <span className="chat-hint">Enter to send, Shift+Enter for a new line</span>
              <button className="primary-btn" type="submit" disabled={!selectedTopic || !chatInput.trim() || isLoading}>
                {isLoading ? 'Thinking…' : 'Send'}
              </button>
            </div>
          </form>
        </section>
      </main>

      {libraryOpen && (
        <div className="modal-backdrop" onClick={closeLibrary}>
          <div className="modal-sheet card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="section-label">Study library</div>
                <h2>Saved work, history, quizzes, and comparisons</h2>
              </div>
              <button className="ghost-btn" onClick={closeLibrary}>Close</button>
            </div>
            <div className="library-tabs">
              {['bookmarks', 'history', 'quiz', 'compare'].map((tab) => (
                <button key={tab} className={`tab-btn ${libraryTab === tab || currentView === tab ? 'active' : ''}`} onClick={() => { setLibraryTab(tab); setCurrentView(tab); }}>
                  {tab}
                </button>
              ))}
            </div>
            <div className="library-body">{libraryContent[libraryTab]}</div>
          </div>
        </div>
      )}
    </div>
  );
}
