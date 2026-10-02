// Cloudflare Worker — Memorizer Proxy
// Holds GEMINI_API_KEY as secret, forwards image to Gemini, returns JSON
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Rate limiting by IP (10 req / hour)
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateKey = `rate:${ip}`;
    let count = 0;
    try {
      count = parseInt((await env.KV?.get(rateKey)) || '0', 10) || 0;
    } catch (e) { count = 0; }
    if (count >= 10) {
      return jsonResponse({ error: 'Too many requests. Try again in an hour.' }, 429);
    }
    try {
      await env.KV?.put(rateKey, String(count + 1), { expirationTtl: 3600 });
    } catch (e) {}

    if (!env.GEMINI_API_KEY) {
      return jsonResponse({ error: 'Server misconfigured: missing GEMINI_API_KEY' }, 500);
    }

    try {
      const formData = await request.formData();
      const imageFile = formData.get('image');
      if (!imageFile) {
        return jsonResponse({ error: 'No image provided' }, 400);
      }

      // Check size (max 5MB)
      const buffer = await imageFile.arrayBuffer();
      if (buffer.byteLength > 5 * 1024 * 1024) {
        return jsonResponse({ error: 'Image too large (max 5MB)' }, 400);
      }

      const bytes = new Uint8Array(buffer);
      let binary = '';
      const CHUNK = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
      }
      const base64Image = btoa(binary);
      
      const prompt = `You are a Bengali/English OCR and question generator. Extract text from this textbook page image and create a question bank.

Rules:
- Split text into 4-5 semantic chunks (5-7 lines each)
- Generate AS MANY MCQs AS POSSIBLE for each chunk to ensure deep memorization
- You MUST generate a MINIMUM of 5 tricky MCQs per chunk. Do not generate just 1 or 2 questions. Extract every possible detail to test the user
- Questions in Bengali if text is Bengali, English if English
- 4 options per question, exactly one correct
- Distractors must be confusing: similar names, swapped numbers, near-synonyms, dates off by 1
- Highlight key terms (exact substrings from text)
- If image is unreadable, return {"error":"unreadable"}

Return JSON:
{
  "chunks": [{
    "id": 1,
    "title": "chunk title",
    "text": "clean OCR text",
    "highlights": ["exact substrings"],
    "complexity": "easy|medium|hard",
    "lines": [{"line_id":"1-1","text":"line text"}],
    "questions": [{
      "id":"q1",
      "line_id":"1-1",
      "type":"mcq",
      "q":"question",
      "options":["opt1","opt2","opt3","opt4"],
      "answer":0,
      "explanation":"why"
    }]
  }],
  "key_notes": ["important facts"]
}`;

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
              ]
            }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json'
            }
          })
        }
      );

      if (!geminiResponse.ok) {
        const errText = await geminiResponse.text();
        console.error('Gemini error:', errText);
        return jsonResponse({ error: 'AI service error' }, 500);
      }

      const geminiData = await geminiResponse.json();
      const textContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textContent) {
        return jsonResponse({ error: 'No response from AI' }, 500);
      }

      let parsed = null;
      try {
        parsed = JSON.parse(textContent);
      } catch (e) {
        const s = String(textContent).trim();
        const start = s.indexOf('{');
        const end = s.lastIndexOf('}');
        if (start > -1 && end > start) {
          try { parsed = JSON.parse(s.slice(start, end + 1)); } catch (e2) {}
        }
        if (!parsed) {
          const m = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
          if (m && m[1]) {
            try { parsed = JSON.parse(m[1].trim()); } catch (e3) {}
          }
        }
      }
      if (!parsed) {
        return jsonResponse({ error: 'AI response parse failed' }, 500);
      }
      return jsonResponse(parsed, 200);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ error: 'Server error' }, 500);
    }
  }
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
