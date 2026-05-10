import fetch from 'node-fetch';

// Same fallback chain as aiController; cheaper-first to keep notification cost low.
const GEMINI_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash',
];

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Generates a short (1-2 sentence) personalized English line for notification emails.
 * Returns the fallback string if Gemini is unavailable or returns nothing useful.
 *
 * Used by notificationService to spice up an otherwise static template.
 */
export const generateMotivationalLine = async ({ kind, userName, fallback, context }) => {
  if (!process.env.GEMINI_API_KEY) return fallback;

  const safeUserName = userName?.trim() || 'there';

  // The system prompt is tightly scoped: 1-2 sentences, English, addresses by name,
  // no markdown, no emojis (HTML email already has its own styling).
  const systemInstruction = `You write a single short personalized message that will be embedded
inside a financial-notification email body. Hard constraints:
- Output ONLY the message text. No greeting, no closing, no headers, no markdown, no emojis.
- 1 to 2 sentences. Maximum ~40 words.
- Address the user as "${safeUserName}" at least once.
- English only.
- Match the emotional tone implied by the kind: "pot_milestone" = encouraging, "budget_warning" = direct/concerned, "budget_critical" = urgent, "budget_daily_spike" = sharp wake-up call, "bill_due" = practical reminder.
- Use the numeric context if it makes the line more specific.

Notification kind: ${kind}
Context: ${JSON.stringify(context || {})}`;

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: 'Write the message now.' }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 120 },
  });

  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(
        `${GEMINI_BASE}/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
      );

      if (!response.ok) continue;
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.trim()) {
        // Strip surrounding quotes Gemini sometimes adds.
        return text.trim().replace(/^["'`]+|["'`]+$/g, '');
      }
    } catch (err) {
      console.warn(`[aiCopywriter] ${model} failed:`, err.message);
    }
  }

  return fallback;
};
