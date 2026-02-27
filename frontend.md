# Athena — Frontend Implementation Guide

## Overview

This document covers the full frontend approach for Athena: design language, tech stack, architecture, state management, the chat context challenge, and the WebSocket/SSE streaming implementation.

The existing `frontend/frontend.html` is a single-file prototype. The real frontend is a React 18 + TypeScript application built with Vite, deployed as a PWA.

---

## Current Implementation State (as of 2026-02-26)

### Actual Tech Stack (differs from spec below)

| Concern | Planned | Actual |
|---|---|---|
| Framework | Vite + React 18 | **Next.js 15 App Router** |
| Routing | React Router v7 | **Next.js App Router (`app/`)** |
| Styling | Tailwind CSS v4 | **Tailwind CSS v3** |
| Animation | Framer Motion | Framer Motion ✅ |
| State | Zustand | Zustand ✅ |
| Icons | Lucide React | Lucide React ✅ |
| API proxy | vite.config proxy | **next.config.mjs rewrites `/api/*` → `localhost:8000/api/*`** |

### Design System — Precision Glass v2.1 (not original Liquid Glass)

The actual design diverges from the spec below. Key differences:

- Background: `hsl(240 10% 3.9%)` — deep zinc-blue, not pure `#09090b`
- No glows, no `translateY` hover — `scale(1.01)` + border contrast only
- Nav active state: 2px left border, no background fill
- Progress bars: `h-px rounded-none` (1px precision lines)
- Typing dots: 4px, `hsl(var(--muted-foreground))`, not primary blue
- Fonts: **Inter Tight** (display/headings), **Inter** (body), **JetBrains Mono** (data)
- Corners: `rounded-sm` throughout (not `rounded-2xl`)
- Primary button: `bg-foreground text-background` (white button, no glow effect)

### What's Implemented

- **App shell** — Next.js App Router layout with sidebar, tab bar (6 tabs), system footer
- **Auth** — JWT login form, `useAuthStore` (Zustand), auth guard on `(app)` layout
- **Chat tab** — full SSE streaming chat, optimistic user messages, typing indicator, conversation list + switching, message history load on click
- **Markdown rendering** — `react-markdown` + `remark-gfm` in `Message.tsx`
- **Source citations** — `SourcesPanel` (collapsible, deduped by filename) in `Message.tsx`
- **Tier badge** — `TierBadge` rendered on assistant messages with `model_used`
- **Documents tab** — drag-drop upload zone, staged file queue, per-document progress display, delete with optimistic removal
- **System footer** — live polling via `useSystemStats` hook, `GET /api/system/resources` every 10s
- **API client** — `frontend/api/client.ts` with typed `get`, `post`, `del`, `postStream` wrappers

### What's NOT Implemented (frontend)

- **Stream abort / stop button** — `Square` icon is shown in `MessageInput` during streaming but not wired to any `AbortController`. No way to cancel mid-stream.
- **Token flush throttle** — `appendStreamToken` fires a React state update per SSE token. Needs ref buffer + 50ms flush.
- **Auto-scroll at-bottom detection** — `MessageList` always scrolls to bottom on token arrival. No check if user has scrolled up.
- **Suggestion/recommendation pills** — no pre-prompt pill buttons above input
- **Document attachment UI in chat** — API endpoints exist (`POST/DELETE /api/chat/{id}/documents/{doc_id}`) but no frontend panel to attach/detach docs to an active conversation
- **Start chat from document** — no "Chat about this" button in Documents tab
- **Chat mode selector** — `knowledge_tier` hardcoded to `'ephemeral'` in `useSSEChat`; no UI toggle for "search all knowledge base"
- **URL ingestion UI** — `UploadZone` is file-only; no URL input field
- **Delete confirmation** — delete fires immediately on hover+click
- **Bulk document progress** — per-document `forEach` poll loop at `DocumentList.tsx:117`; blocked on backend bulk endpoint
- **PromotionCard** — not implemented; `StreamDone` type doesn't include `promotion_suggestion`
- **Virtualization** — no `@tanstack/react-virtual`
- **`contextBudget` wrong** — hardcoded to `4096` in `chat.store.ts`; should be `8192`
- **Research, Quizzes, Knowledge Graph, Settings tabs** — all stubs

### File Structure (actual, differs from spec)

```
frontend/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   └── (app)/
│       ├── layout.tsx              # auth guard
│       └── [tab]/page.tsx          # 6 routes: chat, research, graph, quizzes, documents, settings
├── components/
│   ├── chat/
│   │   ├── ChatWindow.tsx
│   │   ├── MessageList.tsx
│   │   ├── Message.tsx             # markdown, SourcesPanel, TierBadge all here
│   │   └── MessageInput.tsx        # Square icon shown but not wired for abort
│   ├── documents/
│   │   ├── DocumentsPanel.tsx
│   │   ├── DocumentList.tsx        # per-document polling bug at line 117
│   │   └── UploadZone.tsx          # file-only, no URL input
│   ├── layout/
│   │   ├── Sidebar.tsx             # conversation list + switching ✅
│   │   └── SystemFooter.tsx        # live polling ✅
│   └── ui/
│       ├── GlassCard.tsx
│       └── GlassButton.tsx
├── hooks/
│   ├── useSSEChat.ts               # no AbortController, no token flush throttle
│   └── useSystemStats.ts           # ✅ implemented
├── stores/
│   ├── auth.store.ts
│   ├── chat.store.ts               # contextBudget wrong (4096 vs 8192)
│   ├── ui.store.ts
│   └── system.store.ts
├── api/
│   └── client.ts                   # ✅ typed wrappers, no AbortSignal support yet
└── types/
    └── index.ts                    # StreamDone missing promotion_suggestion field
```

---

---

## Design Language: Liquid Glass Minimalism

### Philosophy

Apple's latest design direction (visionOS, iOS 26, macOS 15 Tahoe) — clean spatial UI with translucent glass surfaces, generous whitespace, and restrained use of color. The interface recedes so content leads.

Key principles:
- **Surface over decoration.** Glass panels float over a deep background. No heavy chrome.
- **Motion with purpose.** Transitions communicate state, not style.
- **Type-first hierarchy.** Font weight and size carry meaning. Color is secondary.
- **Breathing room.** Generous padding. Nothing feels cramped.
- **Monochrome foundation.** Near-black background with near-white text. Accent color used sparingly.

### Color Palette

```css
:root {
  /* Base */
  --bg-base: #09090b;           /* zinc-950 — near-black background */
  --bg-elevated: #18181b;       /* zinc-900 — slightly lifted surface */

  /* Glass surfaces */
  --glass-bg: rgba(255, 255, 255, 0.05);
  --glass-bg-hover: rgba(255, 255, 255, 0.08);
  --glass-bg-active: rgba(255, 255, 255, 0.12);
  --glass-border: rgba(255, 255, 255, 0.10);
  --glass-border-strong: rgba(255, 255, 255, 0.18);

  /* Text */
  --text-primary: rgba(255, 255, 255, 0.92);
  --text-secondary: rgba(255, 255, 255, 0.50);
  --text-tertiary: rgba(255, 255, 255, 0.28);

  /* Accent — a single cool blue used for active states + CTAs */
  --accent: #3b82f6;            /* blue-500 */
  --accent-glow: rgba(59, 130, 246, 0.20);
  --accent-subtle: rgba(59, 130, 246, 0.10);

  /* Semantic */
  --success: rgba(34, 197, 94, 0.80);   /* green, muted */
  --warning: rgba(251, 191, 36, 0.80);  /* amber, muted */
  --error: rgba(239, 68, 68, 0.80);     /* red, muted */

  /* Blur */
  --blur-sm: blur(8px);
  --blur-md: blur(16px);
  --blur-lg: blur(32px);
}
```

### Typography

**Primary font:** `Inter` (variable font) — clean, neutral, excellent legibility.

**Display/heading font:** `Instrument Display` or `Bricolage Grotesque` — slightly personality, still minimal. Use only for large headings (the Athena wordmark, section titles).

```css
/* tailwind.config.ts */
fontFamily: {
  sans: ['Inter var', 'Inter', 'system-ui', 'sans-serif'],
  display: ['Instrument Display', 'Georgia', 'serif'],
  mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
}

/* Type scale */
/* Display: 40–56px, font-weight: 300–400, letter-spacing: -0.03em */
/* Heading: 20–32px, font-weight: 500–600, letter-spacing: -0.02em */
/* Body: 14–16px, font-weight: 400, letter-spacing: 0 */
/* Label/meta: 11–13px, font-weight: 500, letter-spacing: 0.04em, uppercase */
```

### Glass Card Component

The fundamental building block. Every panel is this:

```css
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: var(--blur-md);
  -webkit-backdrop-filter: var(--blur-md);
  border: 1px solid var(--glass-border);
  border-radius: 16px;

  /* Subtle inner highlight at top edge — the "liquid glass" feel */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 4px 24px rgba(0, 0, 0, 0.40),
    0 1px 4px rgba(0, 0, 0, 0.20);
}

.glass-card:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-strong);
}
```

### Background

A very subtle animated gradient that slowly shifts — creates depth behind the glass surfaces without being distracting.

```tsx
// Background.tsx — rendered once, behind everything
<div className="fixed inset-0 -z-10">
  {/* Deep base */}
  <div className="absolute inset-0 bg-zinc-950" />

  {/* Soft ambient orbs — blurred, slow-moving */}
  <div className="absolute top-0 left-1/4 w-[600px] h-[600px]
                  bg-blue-600/10 rounded-full blur-[120px]
                  animate-pulse-slow" />
  <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px]
                  bg-violet-600/08 rounded-full blur-[100px]
                  animate-pulse-slow delay-1000" />
</div>
```

---

## Tech Stack

| Concern | Library | Reason |
|---|---|---|
| Framework | React 18 + TypeScript | Specified in CLAUDE.md |
| Build | Vite | Fast HMR, ESM native |
| Styling | Tailwind CSS v4 | Utility-first, collocated |
| Animation | Framer Motion | Declarative, spring physics |
| State (client) | Zustand | Lightweight, no boilerplate |
| State (server) | TanStack Query v5 | Caching, background refetch, SSE |
| Routing | React Router v7 | Tab-based navigation |
| Icons | Lucide React | Clean, consistent, tree-shakeable |
| Graphs | D3.js (Phase 6) | Force-directed, full control |
| PWA | Vite PWA plugin | Service worker, installable |
| Forms | React Hook Form | Performant, uncontrolled |
| Code highlight | Shiki | Token-accurate, themeable |

---

## Project Structure

```
frontend/src/
├── components/
│   ├── chat/
│   │   ├── ChatWindow.tsx       # Main chat container, manages SSE connection
│   │   ├── MessageList.tsx      # Virtualized message list
│   │   ├── Message.tsx          # Single message (user or assistant)
│   │   ├── StreamingMessage.tsx # In-progress streaming message
│   │   ├── MessageInput.tsx     # Textarea + send button + tier indicator
│   │   ├── PromotionCard.tsx    # Promotion suggestion card (below message)
│   │   ├── SourcesDrawer.tsx    # Collapsible RAG sources panel
│   │   └── TierBadge.tsx        # "Tier 1 · 7B · 1.8s" badge
│   ├── layout/
│   │   ├── AppShell.tsx         # Root layout: sidebar + content + footer
│   │   ├── Sidebar.tsx          # Conversation list + nav
│   │   ├── TabBar.tsx           # Chat / Research / Graph / Quizzes / Docs / Settings
│   │   └── SystemFooter.tsx     # Always-visible NVMe / HDD / CPU / GPU bar
│   ├── research/
│   │   ├── ResearchPanel.tsx    # Topic input + approval flow
│   │   ├── PipelineProgress.tsx # Stage-by-stage progress (WebSocket driven)
│   │   └── SynthesisView.tsx    # Completed research result
│   ├── graph/
│   │   └── KnowledgeGraph.tsx   # D3 force-directed visualization
│   ├── quizzes/
│   │   ├── QuizCard.tsx         # Single question card
│   │   ├── QuizResults.tsx      # Score + concept mastery breakdown
│   │   └── MasteryHeatmap.tsx   # Concept strength visualization
│   ├── documents/
│   │   ├── DocumentList.tsx     # Grid of uploaded documents
│   │   ├── UploadZone.tsx       # Drag-and-drop + file picker
│   │   └── ProcessingStatus.tsx # Progress indicator while embedding
│   └── ui/                      # Design system primitives
│       ├── GlassCard.tsx        # Base glass panel
│       ├── GlassButton.tsx      # Primary / ghost / danger variants
│       ├── GlassInput.tsx       # Styled text input
│       ├── Badge.tsx            # Small status badges
│       ├── Spinner.tsx          # Loading indicator
│       └── Tooltip.tsx          # Hover tooltip
├── hooks/
│   ├── useSSEChat.ts            # SSE streaming for chat
│   ├── useResearchWS.ts         # WebSocket for research pipeline
│   ├── useSystemStats.ts        # Polling system resource stats
│   ├── useScrollBehavior.ts     # Smart auto-scroll logic
│   └── useConversation.ts       # Conversation load + history
├── stores/
│   ├── chat.store.ts            # Active conversation, messages, streaming state
│   ├── ui.store.ts              # Active tab, sidebar open, modal state
│   ├── documents.store.ts       # Document list, upload progress
│   ├── research.store.ts        # Research sessions, pipeline stage state
│   └── system.store.ts          # System stats cache
├── api/
│   └── client.ts                # Typed fetch wrappers for every endpoint
├── types/
│   └── index.ts                 # Shared TypeScript types (mirrors Pydantic schemas)
├── App.tsx
├── main.tsx
└── index.css                    # Tailwind directives + CSS custom properties
```

---

## State Management

### Zustand Stores

Each domain has its own store. No single global store.

**`stores/chat.store.ts`** — the most complex store:

```typescript
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  modelTier?: number
  modelName?: string
  latencyMs?: number
  ragSources?: RagSource[]
  promotionSuggestion?: PromotionSuggestion
  isStreaming?: boolean         // true while tokens arriving
}

interface ConversationState {
  id: string
  title: string
  knowledgeTier: 'ephemeral' | 'persistent'
  messages: Message[]
  isLoading: boolean
}

interface ChatStore {
  conversations: Record<string, ConversationState>
  activeConversationId: string | null

  // Actions
  setActiveConversation: (id: string) => void
  createConversation: (tier: 'ephemeral' | 'persistent') => string
  appendToken: (conversationId: string, messageId: string, token: string) => void
  finalizeMessage: (conversationId: string, messageId: string, metadata: MessageMetadata) => void
  addUserMessage: (conversationId: string, content: string) => string  // returns optimistic ID
  setPromotionSuggestion: (conversationId: string, messageId: string, suggestion: PromotionSuggestion) => void
}
```

Key design: `appendToken` mutates a single message's content string in-place. This prevents full list re-renders on every token.

**`stores/research.store.ts`**:

```typescript
interface ResearchStore {
  sessions: Record<string, ResearchSession>
  activePipelineId: string | null

  setStageUpdate: (researchId: string, update: StageUpdate) => void
  setSessionStatus: (researchId: string, status: string) => void
}
```

---

## Chat Context Management

This is the hardest UI problem in Athena. Here's the complete approach.

### The Challenges

1. **Re-render thrashing during streaming.** If each token triggers a React state update, you get 30–50 re-renders per second. The entire message list re-renders. Unacceptable.

2. **Scroll position management.** When new tokens arrive, the list should auto-scroll — but only if the user is already at the bottom. If they've scrolled up to read something, don't hijack them.

3. **Conversation switching.** Switching conversations must be instant. History for each conversation must be cached in the store. Never re-fetch if already loaded.

4. **Long conversations.** After 50+ messages, the DOM becomes large. Need virtualization.

5. **Summarization boundary.** The backend may summarize old messages to stay within the token budget. The UI should show a subtle divider: "Older messages summarized" — not hide this from the user.

6. **Optimistic UI.** The user's message must appear instantly on send, before the API responds. It gets a temporary ID that gets replaced by the real one.

### Solution: Token Accumulation with Flush Throttle

The key insight: accumulate tokens in a **ref** (not state), and flush to state on a throttle (every 50ms or on chunk boundaries). This collapses 20 state updates into 1.

```typescript
// hooks/useSSEChat.ts
export function useSSEChat(conversationId: string) {
  const store = useChatStore()
  const tokenBuffer = useRef<string>('')
  const flushTimer = useRef<ReturnType<typeof setTimeout>>()
  const activeMessageId = useRef<string | null>(null)

  const flushBuffer = useCallback(() => {
    if (!activeMessageId.current || !tokenBuffer.current) return
    store.appendToken(conversationId, activeMessageId.current, tokenBuffer.current)
    tokenBuffer.current = ''
  }, [conversationId, store])

  const sendMessage = useCallback(async (message: string) => {
    // 1. Optimistic: add user message immediately
    const optimisticUserMsgId = store.addUserMessage(conversationId, message)

    // 2. Create placeholder assistant message (shows typing indicator)
    const assistantMsgId = crypto.randomUUID()
    store.addAssistantPlaceholder(conversationId, assistantMsgId)
    activeMessageId.current = assistantMsgId

    // 3. Start SSE stream via fetch (not EventSource — we need POST)
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
        knowledge_tier: store.conversations[conversationId]?.knowledgeTier ?? 'ephemeral'
      })
    })

    if (!response.body) return
    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value, { stream: true })
      // Parse SSE lines: "data: {...}\n\n"
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const payload = JSON.parse(line.slice(6))

        if (payload.type === 'token') {
          // Accumulate in buffer, schedule flush
          tokenBuffer.current += payload.content
          clearTimeout(flushTimer.current)
          flushTimer.current = setTimeout(flushBuffer, 50)

        } else if (payload.type === 'done') {
          // Flush remaining buffer immediately
          flushBuffer()
          // Finalize message with metadata
          store.finalizeMessage(conversationId, assistantMsgId, {
            ragSources: payload.sources,
            promotionSuggestion: payload.promotion_suggestion,
            modelTier: payload.model_tier,
            latencyMs: payload.latency_ms,
          })
        }
      }
    }
  }, [conversationId, store, flushBuffer])

  return { sendMessage }
}
```

### Message List: Virtualization

For long conversations, only render messages in the viewport.

```tsx
// components/chat/MessageList.tsx
import { useVirtualizer } from '@tanstack/react-virtual'

export function MessageList({ messages }: { messages: Message[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,   // estimated message height
    overscan: 5,               // render 5 above/below viewport
  })

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto">
      <div style={{ height: virtualizer.getTotalSize() }} className="relative">
        {virtualizer.getVirtualItems().map(item => (
          <div
            key={item.key}
            style={{
              position: 'absolute',
              top: 0,
              transform: `translateY(${item.start}px)`,
              width: '100%',
            }}
          >
            <Message message={messages[item.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Smart Auto-Scroll

The rule: auto-scroll only if the user was already at the bottom. If they've scrolled up, don't interrupt them.

```typescript
// hooks/useScrollBehavior.ts
export function useScrollBehavior(parentRef: RefObject<HTMLElement>) {
  const isAtBottom = useRef(true)

  // Track whether user is at bottom
  useEffect(() => {
    const el = parentRef.current
    if (!el) return
    const onScroll = () => {
      const threshold = 80  // px from bottom counts as "at bottom"
      isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [parentRef])

  // Call this when new content arrives
  const scrollToBottom = useCallback((force = false) => {
    if (!isAtBottom.current && !force) return
    parentRef.current?.scrollTo({
      top: parentRef.current.scrollHeight,
      behavior: 'smooth'
    })
  }, [parentRef])

  return { scrollToBottom, isAtBottom }
}
```

### Conversation Switching

When switching conversations:
1. If messages are in store → instant render, no fetch
2. If not in store → fetch history from `/api/chat/history/{conversation_id}`, populate store, render

```typescript
// hooks/useConversation.ts
export function useConversation(conversationId: string) {
  const store = useChatStore()
  const isLoaded = !!store.conversations[conversationId]

  useEffect(() => {
    if (isLoaded || !conversationId) return
    // Fetch and populate store
    api.getChatHistory(conversationId).then(history => {
      store.loadConversation(conversationId, history)
    })
  }, [conversationId, isLoaded])
}
```

### Summarization Boundary

When the backend summarizes old messages, the response includes a `summary_marker` flag on the oldest returned messages. The UI renders a subtle divider:

```tsx
// Inside MessageList render
{message.isSummaryBoundary && (
  <div className="flex items-center gap-3 py-3 text-xs text-white/30">
    <div className="flex-1 h-px bg-white/10" />
    <span className="font-medium tracking-widest uppercase">Older messages summarized</span>
    <div className="flex-1 h-px bg-white/10" />
  </div>
)}
```

---

## Streaming: SSE vs WebSocket

Per CLAUDE.md, two different protocols are used for different purposes.

### SSE for Chat (One-Way Token Stream)

**Why SSE over WebSocket for chat:**
- HTTP/1.1 compatible, works through any proxy or CDN
- Auto-reconnect is built into the browser (`EventSource`)
- Simpler server implementation (FastAPI `StreamingResponse`)
- One-way is sufficient — chat is request → stream response

**Why `fetch` + `ReadableStream` instead of `EventSource`:**
- `EventSource` only supports GET requests
- We need POST (to send the message body)
- `fetch` + manual stream reader gives us the same result with POST

**Backend (FastAPI):**

```python
# api/chat.py
async def stream_chat(messages: list, conversation_id: str):
    async for chunk in ollama.chat_stream(messages):
        token = chunk["message"]["content"]
        yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

    # Final event with metadata
    metadata = await build_response_metadata(conversation_id)
    yield f"data: {json.dumps({'type': 'done', **metadata})}\n\n"

@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    # ... assemble messages ...
    return StreamingResponse(
        stream_chat(messages, request.conversation_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",    # important: disable nginx buffering
        }
    )
```

**Nginx config (critical):**

```nginx
location /api/chat {
    proxy_pass http://backend:8000;
    proxy_buffering off;           # must be off for SSE
    proxy_cache off;
    proxy_set_header Connection '';
    proxy_http_version 1.1;
    chunked_transfer_encoding on;
}
```

### WebSocket for Research Pipeline (Bidirectional)

Research uses WebSocket because:
- Server pushes progress events throughout a multi-minute pipeline
- Client may send a cancel message at any time

**Backend (FastAPI):**

```python
# api/research.py
@router.websocket("/ws/research/{research_id}")
async def research_ws(websocket: WebSocket, research_id: str):
    await websocket.accept()
    # Subscribe to this research session's Redis pub/sub channel
    async with redis.subscribe(f"research:{research_id}") as channel:
        async for message in channel:
            if message["type"] == "message":
                await websocket.send_json(json.loads(message["data"]))
            # Check if client cancelled
            try:
                client_msg = await asyncio.wait_for(websocket.receive_json(), timeout=0.01)
                if client_msg.get("type") == "cancel":
                    celery_app.control.revoke(research_id, terminate=True)
                    await websocket.send_json({"status": "cancelled"})
                    break
            except asyncio.TimeoutError:
                pass

# In each Celery stage, publish progress:
# redis.publish(f"research:{research_id}", json.dumps({"stage": N, "status": "running", ...}))
```

**Frontend hook:**

```typescript
// hooks/useResearchWS.ts
export function useResearchWS(researchId: string | null) {
  const store = useResearchStore()
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!researchId) return

    const ws = new WebSocket(`ws://localhost/ws/research/${researchId}`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      const update: StageUpdate = JSON.parse(event.data)
      store.setStageUpdate(researchId, update)

      if (update.status === 'complete' && update.stage === undefined) {
        // Pipeline fully done
        store.setSessionStatus(researchId, 'complete')
        ws.close()
      }
    }

    ws.onclose = () => {
      wsRef.current = null
    }

    // Reconnect with backoff if unexpectedly closed
    ws.onerror = () => {
      // Exponential backoff reconnect logic here
    }

    return () => ws.close()
  }, [researchId])

  const cancel = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'cancel' }))
  }, [])

  return { cancel }
}
```

---

## Layout: AppShell

```
┌─────────────────────────────────────────────────────────────┐
│  Tab bar: Chat · Research · Graph · Quizzes · Docs · Settings│ ← 48px, glass
├────────────────┬────────────────────────────────────────────┤
│                │                                            │
│   Sidebar      │         Main Content Area                  │
│   (240px)      │                                            │
│                │                                            │
│  Athena        │                                            │
│  ─────────     │                                            │
│  Conversations │                                            │
│                │                                            │
│  > Ephemeral   │                                            │
│    Today       │                                            │
│                │                                            │
│  > Persistent  │                                            │
│    My Notes    │                                            │
│                │                                            │
│                │                                            │
├────────────────┴────────────────────────────────────────────┤
│  NVMe [████░░] 7%   HDD [███░░░] 16%   CPU 12%   GPU 4.2GB │ ← 36px footer
└─────────────────────────────────────────────────────────────┘
```

### Sidebar Conversation List

Each conversation entry shows:
- Title (first few words of first message, truncated)
- Relative time ("2 hours ago")
- Tier indicator: small dot — muted for ephemeral, glowing blue for persistent

### System Footer

Always visible. Reads from `system.store.ts` which polls `/api/system/resources` every 10 seconds.

```tsx
// components/layout/SystemFooter.tsx
function ResourceBar({ label, value, max, unit }: ResourceBarProps) {
  const pct = (value / max) * 100
  return (
    <div className="flex items-center gap-2">
      <span className="text-white/30 text-xs font-medium tracking-wider uppercase">{label}</span>
      <div className="w-16 h-1.5 rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-white/40 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-white/50 text-xs">{value}{unit}</span>
    </div>
  )
}
```

---

## Chat UI Component Details

### Message Component

```tsx
// components/chat/Message.tsx
export function Message({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn("flex gap-3 px-4 py-3", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div className={cn(
        "w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold",
        isUser
          ? "bg-white/10 text-white/60"
          : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
      )}>
        {isUser ? 'U' : 'A'}
      </div>

      {/* Content */}
      <div className={cn("flex flex-col gap-2 max-w-[76%]", isUser && "items-end")}>
        <div className={cn(
          "px-4 py-3 rounded-2xl text-sm leading-relaxed",
          isUser
            ? "bg-white/10 text-white/90 rounded-tr-sm"
            : "bg-white/5 border border-white/08 text-white/85 rounded-tl-sm"
        )}>
          {/* Markdown rendered content */}
          <MarkdownRenderer content={message.content} />
        </div>

        {/* Metadata row */}
        {!isUser && message.modelTier && (
          <div className="flex items-center gap-2">
            <TierBadge tier={message.modelTier} latencyMs={message.latencyMs} />
            {message.ragSources && message.ragSources.length > 0 && (
              <SourcesDrawer sources={message.ragSources} />
            )}
          </div>
        )}

        {/* Promotion suggestion — below message, never inline */}
        {message.promotionSuggestion && (
          <PromotionCard suggestion={message.promotionSuggestion} messageId={message.id} />
        )}
      </div>
    </div>
  )
}
```

### Streaming Message (Typing Indicator)

While tokens are arriving, show a subtle cursor:

```tsx
// components/chat/StreamingMessage.tsx
export function StreamingMessage({ content }: { content: string }) {
  return (
    <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white/5 border border-white/08 text-sm text-white/85 leading-relaxed">
      {content}
      {/* Blinking cursor */}
      <span className="inline-block w-0.5 h-4 bg-blue-400 ml-0.5 animate-blink align-text-bottom" />
    </div>
  )
}
```

### TierBadge

```tsx
// components/chat/TierBadge.tsx
const TIER_LABELS: Record<number, { model: string; color: string }> = {
  1: { model: '7B', color: 'text-emerald-400/70' },
  2: { model: '30B', color: 'text-amber-400/70' },
  3: { model: '70B', color: 'text-rose-400/70' },
}

export function TierBadge({ tier, latencyMs }: { tier: number; latencyMs?: number }) {
  const { model, color } = TIER_LABELS[tier]
  return (
    <span className={cn("text-xs font-mono", color)}>
      Tier {tier} · {model} {latencyMs && `· ${(latencyMs / 1000).toFixed(1)}s`}
    </span>
  )
}
```

### PromotionCard

The promotion suggestion appears as a glass card below the assistant message, never inline.

```tsx
// components/chat/PromotionCard.tsx
export function PromotionCard({ suggestion, messageId }: PromotionCardProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="glass-card p-3 max-w-sm border-blue-500/20"
    >
      <div className="flex items-start gap-2.5">
        <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-3 h-3 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/80">Save to knowledge base?</p>
          <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{suggestion.reason}</p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => acceptPromotion(suggestion.topic)}
              className="text-xs px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400
                         hover:bg-blue-500/30 transition-colors font-medium"
            >
              Save topic
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="text-xs px-3 py-1 rounded-lg text-white/30 hover:text-white/50 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
```

### MessageInput

```tsx
// components/chat/MessageInput.tsx
export function MessageInput({ conversationId }: { conversationId: string }) {
  const [value, setValue] = useState('')
  const { sendMessage } = useSSEChat(conversationId)
  const isStreaming = useChatStore(s => s.conversations[conversationId]?.isStreaming)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async () => {
    const msg = value.trim()
    if (!msg || isStreaming) return
    setValue('')
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    await sendMessage(msg)
  }

  // Auto-grow textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`
  }

  return (
    <div className="p-4 border-t border-white/08">
      <div className="glass-card flex items-end gap-2 p-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder="Ask anything..."
          rows={1}
          className="flex-1 bg-transparent resize-none text-sm text-white/85
                     placeholder:text-white/25 outline-none leading-relaxed px-2 py-1"
          style={{ maxHeight: '200px' }}
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || isStreaming}
          className="w-8 h-8 rounded-xl bg-blue-500 hover:bg-blue-400
                     disabled:opacity-30 disabled:cursor-not-allowed
                     flex items-center justify-center transition-all"
        >
          {isStreaming
            ? <Loader2 className="w-4 h-4 text-white animate-spin" />
            : <ArrowUp className="w-4 h-4 text-white" />
          }
        </button>
      </div>
      <p className="text-center text-xs text-white/20 mt-2">
        Enter to send · Shift+Enter for newline
      </p>
    </div>
  )
}
```

---

## Research Pipeline UI

### PipelineProgress

Driven entirely by WebSocket events from `useResearchWS`:

```tsx
const STAGES = [
  { id: 1, label: 'Collecting sources' },
  { id: 2, label: 'Filtering & scoring' },
  { id: 3, label: 'Checking knowledge base' },
  { id: 4, label: 'Synthesizing' },
  { id: 5, label: 'Ingesting into knowledge' },
]

export function PipelineProgress({ researchId }: { researchId: string }) {
  const session = useResearchStore(s => s.sessions[researchId])
  const { cancel } = useResearchWS(researchId)

  return (
    <div className="glass-card p-5 space-y-4">
      {STAGES.map(stage => (
        <StageRow
          key={stage.id}
          stage={stage}
          status={session?.stageStatuses[stage.id] ?? 'pending'}
          message={session?.stageMessages[stage.id]}
        />
      ))}
      {session?.status === 'running' && (
        <button onClick={cancel} className="text-xs text-white/30 hover:text-white/60">
          Cancel research
        </button>
      )}
    </div>
  )
}
```

---

## Animations

Use Framer Motion for all transitions. Keep them subtle and fast.

```typescript
// Shared animation variants — import and reuse
export const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15 } }
}

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.12 } }
}

export const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: 'backOut' } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.15 } }
}
```

**Tab transitions:** Crossfade between tab content (`AnimatePresence` + `fadeIn`).
**Message appearance:** New messages slide up (`fadeUp`).
**Promotion card:** Scale in from slightly smaller (`scaleIn`).
**No animation during streaming** — token-by-token content changes are not animated (too jarring).

---

## PWA Setup

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Athena',
        short_name: 'Athena',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ]
      }
    })
  ]
})
```

---

## Implementation Order

Build the frontend in this sequence. Each step is independently testable.

### Step 1: Shell + Design System
- Set up Vite + React 18 + TypeScript + Tailwind
- Create CSS custom properties for the glass palette
- Build: `GlassCard`, `GlassButton`, `GlassInput`, `Badge`, `Spinner`
- Build `AppShell` with sidebar, tab bar, footer (all static/mocked)
- No API calls yet — just layout and visual design

### Step 2: Documents Tab
- `UploadZone` (drag-drop + file picker)
- `DocumentList` (grid of cards)
- `ProcessingStatus` (polling document status)
- Wire to `/api/documents` endpoints

### Step 3: Chat (Non-Streaming)
- `ChatWindow`, `MessageList`, `Message`, `MessageInput`
- Wire to `POST /api/chat` without streaming — just fetch and render
- Get conversation list from API, populate sidebar
- Conversation switching

### Step 4: Chat Streaming (SSE)
- Implement `useSSEChat` hook
- Switch from `fetch` to streaming with ReadableStream
- `StreamingMessage` component with blinking cursor
- Token accumulation + flush throttle
- Auto-scroll behavior

### Step 5: Context Display
- `TierBadge` on each message
- `SourcesDrawer` (collapsible)
- `PromotionCard` (appears below message)
- Summarization boundary divider

### Step 6: Research Tab
- Research topic input
- Approval card (approve / cancel before pipeline starts)
- `PipelineProgress` with WebSocket
- `SynthesisView` on completion

### Step 7: Quizzes Tab
- Quiz generation form
- `QuizCard` (question + options)
- Scoring + `QuizResults`
- Spaced repetition queue view

### Step 8: Knowledge Graph Tab
- D3 force-directed graph (nodes + edges)
- Click node → show definition panel
- Filter by node type

### Step 9: System Footer Live Data
- `useSystemStats` polling hook
- Wire `SystemFooter` to live `/api/system/resources`

---

## Key UI Rules (Never Violate)

1. **Promotion suggestion is always a card below the assistant message.** Never inline text. Never a modal.
2. **Auto-scroll only when user is at bottom.** Never hijack scroll position.
3. **Optimistic UI on every user message.** It appears instantly, before any API response.
4. **Never block the UI during streaming.** Input stays enabled (but send button disabled).
5. **The research pipeline must show a cancel option** while running.
6. **Model tier badge on every assistant message.** Not optional — it's core to the experience.
7. **System footer is always visible.** Never hidden by modals or overlays.
8. **Ephemeral conversations have a subtle indicator** (muted dot in sidebar).
