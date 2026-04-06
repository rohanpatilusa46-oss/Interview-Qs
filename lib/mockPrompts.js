export function questionGeneratorPrompt({ difficulty, subsection, mode }) {
  return `Act as a senior interviewer. Generate one ${difficulty} level interview question strictly about ${subsection}.
Mode: ${mode}.
Focus on real-world understanding, tradeoffs, and system design where applicable.
Do not ask outside this subsection.
Return only the question text.`;
}

export function evaluationPrompt({ difficulty, subsection, question, answerText }) {
  return `Evaluate the candidate's answer for a ${difficulty} level interview question on ${subsection}.

Question: ${question}
Candidate answer: ${answerText}

Return valid JSON only:
{
  "score": 0,
  "whatCorrect": ["..."],
  "whatMissing": ["..."],
  "improve": ["..."],
  "idealAnswer": "concise structured ideal answer",
  "strongAreas": ["..."],
  "weakAreas": ["..."]
}

Rules:
- score is integer 0-10
- Keep bullets concise and practical
- Stay strictly inside ${subsection}`;
}

export function followUpPrompt({ difficulty, subsection, question, answerText, weakAreas }) {
  return `Based on the candidate's previous answer, ask a deeper follow-up question that probes weaknesses.
Difficulty: ${difficulty}
Subsection: ${subsection}
Original question: ${question}
Candidate answer: ${answerText}
Weak areas: ${(weakAreas || []).join(', ') || 'N/A'}

Return only one follow-up question strictly about ${subsection}.`;
}
