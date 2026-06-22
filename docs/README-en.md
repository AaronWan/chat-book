# Liaoshu · 聊书

> Conversational deep reading — engage in intellectual dialogue with author agents and crystallize your genuine reflections.

**MVP Delivery Version · 2026-06-11**

---

## Elevator Pitch

> **Liaoshu** = Conversational deep reading that leaves you with real, crystallized thinking.

Each author is an AI agent that proactively guides readers to think, debate, and generate original insights.

---

## Get Started in 5 Minutes

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (copy from .env.example)
cp .env.example .env

# 3. Start the server
npm start

# 4. Open in browser
open http://localhost:3000
```

On first launch, click **「+ Add Book」**, pick a book from the built-in library, and start chatting.

### Run End-to-End Tests

```bash
npm run smoke
```

Expect all 13 tests to pass.

---

## Built-in Library (6 Books)

| # | Title | Author | Category | Chapters |
|---|-------|--------|----------|----------|
| 1 | The 7 Habits of Highly Effective People | Stephen R. Covey | Management/Self-improvement | 8 |
| 2 | Finite and Infinite Games | James P. Carse | Philosophy/Thinking | 5 |
| 3 | Thinking, Fast and Slow | Daniel Kahneman | Psychology/Decision-making | 5 |
| 4 | Peak | Anders Ericsson | Psychology/Learning | 5 |
| 5 | Atomic Habits | James Clear | Self-improvement/Methodology | 6 |
| 6 | Flow | Mihaly Csikszentmihalyi | Psychology/Well-being | 5 |

---

## Configuration

`.env`:

```env
PORT=3000
LLM_URL=https://aihub.firstshare.cn
LLM_KEY=sk-...                          # your LLM key
LLM_MODEL=claude-sonnet-4-6             # OpenAI-compatible model
DATA_DIR=./data
```

`LLM_KEY` is required. Without it, dialogue cannot call the LLM.

---

*Conversational Deep Reading · Crystallize Your Thinking*
*Liaoshu Team · 2026-06-11*
