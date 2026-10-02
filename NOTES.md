# Memorizer — Setup & Testing Guide

## Overview
Memorizer is an AI-powered textbook memorization tool for Bengali students. Users upload a textbook page image, AI extracts text and generates questions, then students practice with spaced repetition until mastery.

## Architecture
- **Engine** (`js/memorizer/engine.js`): Pure logic state machine (UMD, browser + Node)
- **AI** (`js/memorizer/ai.js`): Image compression + Gemini API proxy
- **UI** (`js/memorizer/ui.js`): DOM rendering, localStorage persistence
- **Mock Data** (`js/memorizer/mock-data.js`): Sample Bengali content for testing
- **Worker** (`worker/memorizer-proxy.js`): Cloudflare Worker proxy (holds API key, rate limiting)

## File Structure
```
f:/My_Site/
├── tools/memorizer.html          # Main HTML page
├── css/memorizer.css              # Mobile-first styles
├── js/memorizer/
│   ├── engine.js                  # Core logic (UMD)
│   ├── ai.js                      # AI integration
│   ├── ui.js                      # UI rendering
│   └── mock-data.js               # Test data
├── worker/
│   ├── memorizer-proxy.js         # Cloudflare Worker
│   └── wrangler.toml              # Worker config
└── tests/
    └── engine.test.mjs            # Node.js tests
```

## Setup Instructions

### 1. Test Engine (No API Key Required)
```bash
cd f:/My_Site
node --test tests/engine.test.mjs
```
Should see: ✅ All tests passed! (10/10 tests)

### 1b. Direct Gemini testing (?direct=1, no Worker needed)
1. Get an AI Studio key: https://aistudio.google.com/app/apikey — starts with `AIza...` (legacy) or `AQ.` (new format). Both are accepted.
2. Open `tools/memorizer.html?direct=1` (served over http://localhost, not file:// — fetch + localStorage need http).
3. Paste the `AIza...` / `AQ.` key in the dashed box → Save (stored only in this browser's localStorage as `memorizer_google_key`).
   - Or pass once via URL: `?direct=1&key=AQ...` (key is read from query, not committed anywhere).
4. Upload a textbook photo → app compresses to ≤1600px JPEG → POSTs directly to `gemini-2.5-flash:generateContent`.
5. Bengali errors: bad key → “API key সঠিক নয়”; 403 → enable API; 429 → wait; unreadable photo → retake.

### 2. Test UI in Browser (Mock Mode)
1. Open `f:/My_Site/tools/memorizer.html` in browser
2. Append `?mock=1` to URL: `file:///f:/My_Site/tools/memorizer.html?mock=1`
3. Click "ছবি তুলুন" or "আপলোড করুন"
4. Mock data loads automatically (Bengali Liberation War content)
5. Test flow: Read → Answer questions → View results → Next chunk

### 3. Deploy Cloudflare Worker
```bash
cd f:/My_Site/worker

# Install Wrangler (if not installed)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create KV namespace for rate limiting
wrangler kv:namespace create "RATE_LIMIT"
# Copy the ID and update wrangler.toml

# Set your Gemini API key as secret
wrangler secret put GEMINI_API_KEY
# Paste your key when prompted

# Deploy worker
wrangler deploy

# Note the worker URL (e.g., https://memorizer-proxy.YOUR_SUBDOMAIN.workers.dev)
```

### 4. Update Worker URL in AI Module
Edit `f:/My_Site/js/memorizer/ai.js`:
```javascript
var CONFIG = {
  WORKER_URL: 'https://memorizer-proxy.YOUR_WORKER_SUBDOMAIN.workers.dev',
  // ... rest
};
```

### 5. Test Full Flow with Real Images
1. Remove `?mock=1` from URL
2. Upload a clear textbook page photo (Bengali or English)
3. AI processes image and generates questions
4. Complete practice rounds

## Testing Checklist

### Engine Logic Tests ✓
- [x] Engine initializes with chunks and questions
- [x] startChunk sets state to 'reading'
- [x] startRound generates questions from pool
- [x] submitAnswer records correct/incorrect
- [x] finishRound calculates score and updates progress
- [x] serialize/deserialize preserves state

### UI Flow Tests (Manual)
- [ ] Home screen shows upload buttons
- [ ] Image upload triggers compression
- [ ] Mock mode loads sample data
- [ ] Reading screen shows chunk text with highlights
- [ ] Round screen displays questions with options
- [ ] Progress bar updates as questions answered
- [ ] Result screen shows score and mastery progress
- [ ] Next chunk button appears after passing
- [ ] Mixed round starts after all chunks mastered
- [ ] Success screen shows key notes
- [ ] localStorage persists state across refreshes

### Edge Cases
- [ ] Large image (>5MB) shows error
- [ ] Unreadable image returns friendly message
- [ ] Rate limit (>10 requests/hour) returns 429
- [ ] Invalid JSON from AI is validated/repaired
- [ ] Empty question bank handled gracefully
- [ ] All questions flagged shows empty round

### Mobile Testing
- [ ] Camera capture works on mobile
- [ ] Touch interactions smooth
- [ ] Text readable on small screens
- [ ] Buttons properly sized for touch
- [ ] Bengali font renders correctly

## API Key Setup

### Get Gemini API Key
1. Go to https://makersuite.google.com/app/apikey
2. Create new API key (free tier: 60 requests/minute)
3. Copy the key

### Rate Limiting
Worker limits: 10 requests per IP per hour
Gemini free tier: 60 requests/minute, 1500/day

## Troubleshooting

### Tests fail with "MemorizerEngine is not defined"
- Check Node.js version >= 18
- Ensure engine.js path is correct in test file

### "No text found" error
- Image quality too low
- Text too small or blurry
- Try better lighting or higher resolution

### Worker 429 errors
- Wait 1 hour or use different IP
- Check KV namespace is bound correctly
- Verify rate limiting logic

### LocalStorage not persisting
- Check browser privacy settings
- Ensure domain not in incognito mode
- Try clearing and restarting

## Performance Notes
- Image compression: <1s (client-side Canvas)
- Gemini API call: 3-8s (depends on image size)
- Question generation: ~40-50 questions per chunk
- First round: 10-20 questions (easy/medium/hard)
- Subsequent rounds: Weighted by wrong answers (3×) vs correct (1×)
- Mastery threshold: 95% correct

## Content Strategy
- **Chunks**: 4-5 semantic units per page (5-7 lines each)
- **Questions**: 30-50 per chunk (multiple per line)
- **Distractors**: Confusing options (similar names, swapped numbers, dates off by 1)
- **Line tracking**: Questions linked to specific lines for targeted practice
- **Mixed rounds**: Final test combining all mastered chunks

## Future Enhancements
- [ ] Export progress as PDF report
- [ ] Offline PWA support
- [ ] Voice question reading
- [ ] Collaborative mode (teacher assigns pages)
- [ ] Analytics dashboard
- [ ] OCR fallback (Tesseract.js)

## License & Credits
Built for Momentum Education (momentum-education.vercel.app)
Gemini 1.5 Flash API for OCR + question generation
