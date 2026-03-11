# Athena — UI Design Vision & System Reference

> A document for recreating the Athena frontend aesthetic, component patterns, and interaction flows. Intended as a handoff reference for any LLM or developer building new views within this system.

---

## Design Philosophy

The aesthetic is called **Structural Glass** — a fusion of two distinct visual languages:

1. **Structural Minimalism** (inspired by dense SaaS data tools): crisp dark surfaces, high-contrast typography, information-dense tables, zero decorative effects on utility views.
2. **Liquid Glass** (reserved for AI/chat surfaces only): subtle translucency, soft borders, atmospheric depth — used *only* where it communicates that the user is interacting with an AI system.

**The core rule:** Glass effects belong on modal overlays only. They do not belong on tables, file lists, folder trees, navigation, or the main panel.

---

## Layout Architecture

The app uses a **two-layer depth model**:

```
┌─────────────────────────────────────────────────────────┐
│  FLOOR  (--floor) — raw background, no decoration        │
│                                                          │
│  ┌─────────┐  ┌────────────────────────────────────┐    │
│  │ SIDEBAR │  │  CONTENT PANEL                     │    │
│  │         │  │  background: var(--surface)        │    │
│  │ sits on │  │  border-radius: 22px               │    │
│  │  floor  │  │  box-shadow: ring + depth          │    │
│  │         │  │  margin: 10px (floats above floor) │    │
│  └─────────┘  └────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

The sidebar lives directly on the floor — no border-radius, no elevation. The main content panel has `border-radius: 22px`, a 1px highlight ring, and a deep drop shadow. This creates a clear "content is floating on top" feeling without any blur or glass on the panel itself.

---

## Theme System

All visual properties are driven by CSS custom properties on `:root`. There are two independent theme axes — **Color Depth** and **Typography** — that combine freely. Switching themes is a single `applyTheme(depth, font)` call that writes new values to `document.documentElement.style`.

### Color Depth Themes

Three depth options. All use the same token names — only the values change.

#### Midnight (default)
Deep near-black. Maximum contrast. Most premium-feeling.

```css
--floor:     #070709;
--surface:   #0d0d11;
--surface-2: #121217;
--raised:    rgba(255,255,255,0.038);
--raised-h:  rgba(255,255,255,0.062);
--raised-a:  rgba(255,255,255,0.092);
--border:    rgba(255,255,255,0.072);
--border-s:  rgba(255,255,255,0.13);
--t1: rgba(255,255,255,0.90);
--t2: rgba(255,255,255,0.52);
--t3: rgba(255,255,255,0.28);
--t4: rgba(255,255,255,0.14);
--panel-shadow: 0 0 0 1px rgba(255,255,255,0.055),
                0 4px 40px rgba(0,0,0,0.55),
                0 1px 0 rgba(255,255,255,0.035) inset;
```

#### Slate
Lifted cool gray. Easier on the eyes for long sessions. Borders read slightly more visibly.

```css
--floor:     #141416;
--surface:   #1c1c21;
--surface-2: #242429;
--raised:    rgba(255,255,255,0.05);
--raised-h:  rgba(255,255,255,0.08);
--raised-a:  rgba(255,255,255,0.11);
--border:    rgba(255,255,255,0.09);
--border-s:  rgba(255,255,255,0.16);
--t1: rgba(255,255,255,0.88);
--t2: rgba(255,255,255,0.54);
--t3: rgba(255,255,255,0.32);
--t4: rgba(255,255,255,0.18);
--panel-shadow: 0 0 0 1px rgba(255,255,255,0.07),
                0 4px 32px rgba(0,0,0,0.4),
                0 1px 0 rgba(255,255,255,0.04) inset;
```

#### Light
Warm off-white. All opacity tokens invert to `rgba(0,0,0,...)`.

```css
--floor:     #e8e6e1;
--surface:   #f8f7f4;
--surface-2: #efede9;
--raised:    rgba(0,0,0,0.04);
--raised-h:  rgba(0,0,0,0.07);
--raised-a:  rgba(0,0,0,0.09);
--border:    rgba(0,0,0,0.09);
--border-s:  rgba(0,0,0,0.16);
--t1: rgba(0,0,0,0.88);
--t2: rgba(0,0,0,0.50);
--t3: rgba(0,0,0,0.30);
--t4: rgba(0,0,0,0.18);
--panel-shadow: 0 0 0 1px rgba(0,0,0,0.07),
                0 4px 32px rgba(0,0,0,0.08),
                0 1px 0 rgba(255,255,255,0.9) inset;
```

### Accent Tokens (shared across all depth themes)

```css
--blue:    #3b7cf4;   --blue-a:   rgba(59,124,244,0.13);
                      --blue-b:   rgba(59,124,244,0.07);
                      --blue-br:  rgba(59,124,244,0.26);

--green:   #34d399;   --green-a:  rgba(52,211,153,0.12);
                      --green-br: rgba(52,211,153,0.24);

--amber:   #f59e0b;   --amber-a:  rgba(245,158,11,0.12);
                      --amber-br: rgba(245,158,11,0.24);

--red:     #f87171;   --red-a:    rgba(248,113,113,0.12);
                      --red-br:   rgba(248,113,113,0.24);

--purple:  #a78bfa;   --purple-a: rgba(167,139,250,0.11);
```

### Document Surface Tokens
Used in white reading panes (research document output, chat doc viewer). These are always light regardless of the active depth theme.

```css
--doc-bg:     #f9f9f7;
--doc-t:      #111;
--doc-t2:     #374151;
--doc-border: #e8e8e5;
--doc-label:  #999;
```

**Never use raw hex values in components.** Always reference these tokens.

---

## Typography

### Font Roles

Five distinct font roles, each with a dedicated CSS variable:

| Variable | Role | Font | Usage |
|---|---|---|---|
| `--font-wordmark` | Brand name | Cormorant Garamond | "Athena" sidebar wordmark only |
| `--fd` | Display / headings | Theme-dependent | Page titles, section headers, nav labels |
| `--fb` | Body / UI | Theme-dependent | All interface chrome, labels, metadata |
| `--fm` | Monospace | JetBrains Mono (always) | File sizes, stats, type badges, chunk counts |
| `--font-ai-msg` | AI response text | Lora (always) | LLM chat bubbles only |

**Fixed across all themes — never changed by font theme switching:**
- `--font-wordmark`: `'Cormorant Garamond', Georgia, serif` — high-contrast, brand-grade. Used only for the "Athena" wordmark at 18px / weight 600 / `letter-spacing: 0.01em`.
- `--font-ai-msg`: `'Lora', Georgia, serif` — designed for screen reading, warm and structured. Used at 13.5px / `line-height: 1.75` in AI response bubbles. Gives the AI a distinct voice separate from the interface chrome.
- `--fm`: `'JetBrains Mono', monospace` — always mono regardless of theme.

### Typography Themes (control `--fd`, `--fb`, `--tr`, `--wd`)

#### Terminal
JetBrains Mono runs everything. Feels like a database client or dev tool.
```css
--fd: 'JetBrains Mono', monospace;
--fb: 'JetBrains Mono', monospace;
--tr: -0.01em;   --wd: 700;
```

#### Editorial
Plus Jakarta Sans headings (weight 800, tight tracking), Poppins body. Product-forward, warm.
```css
--fd: 'Plus Jakarta Sans', sans-serif;
--fb: 'Poppins', sans-serif;
--tr: -0.025em;  --wd: 800;
```

#### Serif
Playfair Display headings, Lora body. Academic, editorial, printed-book quality.
```css
--fd: 'Playfair Display', serif;
--fb: 'Lora', serif;
--tr: -0.01em;   --wd: 700;
```

### Type Scale

| Role | Size | Weight | Font var | Notes |
|---|---|---|---|---|
| Wordmark | 18px | 600 | `--font-wordmark` | `letter-spacing: 0.01em` |
| Page title | 15–17px | `var(--wd)` | `--fd` | `letter-spacing: var(--tr)` |
| Section header | 13px | 600 | `--fd` | — |
| Body / table | 13px | 400 | `--fb` | `line-height: 1.65` |
| AI response | 13.5px | 400 | `--font-ai-msg` | `line-height: 1.75` — Lora serif always |
| Small label | 11–12px | 400–500 | `--fb` | `color: var(--t2)` or `--t3` |
| Section category | 10px | 700 | `--fb` | uppercase, `letter-spacing: 0.08em`, `var(--t4)` |
| Mono values | 11–14px | 400–600 | `--fm` | File sizes, stats, type badges, chunk counts |

---

## Component Patterns

### Sidebar

- Collapsible: `224px` (expanded) ↔ `56px` (collapsed)
- Transition: `width 0.22s cubic-bezier(0.4,0,0.2,1)`
- Collapsed: labels `opacity: 0` / `width: 0`, badges hide, icons center
- Contains: gradient logo icon + Cormorant Garamond wordmark, primary nav (Library / Research / Chat), collections list with color dots, Settings, user avatar
- Background: `var(--floor)` — no elevation, no border-radius

**Collection dots:** `7×7px` square, `border-radius: 2px`, unique accent color per collection. Thread through sidebar, folder tree, and file table rows consistently.

### Nav Items

```css
.nav-item {
  padding: 7px 9px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  font-family: var(--fb);
  color: var(--t3);
  transition: background 0.12s, color 0.12s;
}
.nav-item:hover  { background: var(--raised-h); color: var(--t2); }
.nav-item.active { background: var(--raised-a); color: var(--t1); }
```

### Content Panel (Elevated Card)

```css
.panel {
  flex: 1;
  margin: 10px 10px 10px 0;
  background: var(--surface);
  border-radius: 22px;
  box-shadow: var(--panel-shadow);
  overflow: hidden;
}
```

### File Type Badges

```
Size: 28×28px, border-radius: 7px
PDF → bg: rgba(248,113,113,0.1), border: rgba(248,113,113,0.22), color: var(--red)
MD  → bg: rgba(59,124,244,0.1),  border: rgba(59,124,244,0.22),  color: var(--blue)
Font: var(--fm), 8.5px, weight 700
```

### Pill Tags

```css
.pill {
  padding: 3px 9px;
  border-radius: 100px;
  font-size: 11px;
  font-weight: 500;
  font-family: var(--fb);
  border: 1px solid var(--border);
  color: var(--t2);
  background: var(--raised);
}
.pill.on {
  background: var(--blue-a);
  border-color: var(--blue-br);
  color: var(--blue);
}
```

### Buttons

- **Ghost:** `background: var(--raised)`, `border: var(--border)`, `color: var(--t2)`
- **Primary:** `background: var(--blue)`, `color: white`
- **Success:** `background: var(--green-a)`, `border: var(--green-br)`, `color: var(--green)`
- **Danger:** `background: var(--red-a)`, `border: var(--red-br)`, `color: var(--red)`
- `border-radius: 9px`, `font-size: 12.5px`, `font-weight: 500`, `font-family: var(--fb)`, icon gap: `6px`

### Table / File Rows

```css
.trow {
  display: grid;
  padding: 10px 20px;
  border-bottom: 1px solid rgba(128,128,128,0.08);
  cursor: pointer;
  transition: background 0.1s;
}
.trow:hover    { background: var(--raised-h); }
.trow.selected { background: var(--raised-a); box-shadow: inset 2px 0 0 var(--blue); }
```

Selected rows get a `2px blue left inset shadow`. Column headers: `10px / 700 / uppercase / 0.08em / var(--t4)`.

### Progress Bars

```css
.prog-bar  { height: 3px; border-radius: 2px; background: var(--border); overflow: hidden; }
.prog-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }
```

Color: `< 65%` → blue · `65–85%` → amber · `> 85%` → red

### Status Badges

Dot + label pill. `border-radius: 100px`, `font-size: 11px`, `font-family: var(--fb)`.

| Status | Background | Border | Text | Dot |
|---|---|---|---|---|
| Complete | `var(--green-a)` | `var(--green-br)` | `var(--green)` | Static |
| Running | `var(--blue-a)` | `var(--blue-br)` | `var(--blue)` | Pulse |
| Processing/Indexing | `var(--amber-a)` | `var(--amber-br)` | `var(--amber)` | Static |
| Scraping | `var(--purple-a)` | purple border | `var(--purple)` | Pulse |
| Error | `var(--red-a)` | `var(--red-br)` | `var(--red)` | Static |
| Draft | `var(--raised)` | `var(--border)` | `var(--t3)` | Static |

Pulse dot: `animation: shimmerPulse 2s ease-in-out infinite` (opacity 0.5→1→0.5).

### Toggle Switch

`34×19px`, `border-radius: 100px`. Thumb `13×13px`, transitions `left: 3px` ↔ `left: 18px`.
Off: `background: var(--raised-h)`, `border: var(--border-s)`. On: `background: var(--blue)`.

### Right Panel Tabs

```css
.rpanel-tab {
  padding: 9px 16px;
  border: none;
  background: transparent;
  font-family: var(--fb);
  font-size: 12px;
  font-weight: 500;
  color: var(--t3);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}
.rpanel-tab:hover { color: var(--t2); }
.rpanel-tab.on    { color: var(--t1); border-bottom-color: var(--blue); }
```

---

## Views

### Library View

**Layout:** Two-pane inside the content panel.

**Left pane (210px):** Folder/collection tree with collapsible subfolders, color dot per collection, tag section below a divider.

**Right pane:** File table with tab filter row (All Files / PDF / Markdown / Web), column headers, file rows. Columns: Name (with type badge), Collection (with color dot), Added, Size.

**Header:** Page title + subtitle, search input, Import button → triggers 4-stage upload modal.

---

### Research View

A session-based research pipeline manager — not a chat.

**Layout:** Two-column split.

**Left panel (340px):** Session list. Each card shows query (2-line clamp), status badge, tags, source count, date. Search bar + filter tabs (All / Running / Complete / Draft). New Research button → modal.

**Right panel:** Session detail header (full query, status, source count, action buttons, tags) + two tabs:

#### Sources Tab
- AI synthesis block (complete sessions): blue left-border callout card with research summary
- Running progress block: spinner + progress bar + "X of Y sources processed"
- Scraped sources list: globe icon, title, domain, word count, status badge. Click to expand inline preview with View raw / Open URL
- Empty state (draft): centered icon + "Start the research pipeline to begin scraping"

#### Document Tab
White reading surface (`var(--doc-bg)`). AI-synthesized report with section nav pills, numbered key findings, source analysis list with Cited badges, Gaps & Limitations. Export .md + Chat about this buttons in header. Empty state if session not complete.

#### New Research Modal
Blur overlay. Research query textarea, max sources picker, save-to-collection picker, four toggles. Start button activates once query > 10 chars.

---

### Chat View

General-purpose chat with document scope control. Also serves as Research Chat when launched from a completed research session with context pre-loaded.

**Layout:** Chat panel (420px) + right panel (flex: 1).

#### Chat Panel

**Header:**
- AI gradient avatar + "Chat" title + model dot + scope summary line
- Research context banner (research mode): blue-tinted bar with query text
- Document scope pills (general mode): removable pills showing collection dot + truncated name + × button. "Add doc" button → document picker dropdown.

**Document Picker Dropdown** (anchored below header, closes on outside click):
- Search input filtering by name or collection
- All library docs: type badge, name, collection dot, chunk count
- Clicking toggles in/out of scope — filled blue circle (in scope) vs. empty ring (not)
- Footer: scope count + Done button

**Messages:**

```
User bubble:   right-aligned, bg: var(--blue-a), border: var(--blue-br)
               border-radius: 13px 13px 4px 13px, font: var(--fb) 13px

AI bubble:     left-aligned with 24×24 gradient avatar
               bg: var(--raised), border: var(--border)
               border-radius: 4px 13px 13px 13px
               font: var(--font-ai-msg) 13.5px, line-height 1.75  ← Lora, always
```

Typing indicator: three dots with staggered `blink` animation inside an AI bubble shape.

**Input bar:** `var(--raised)` container. Send button — blue when input has content, muted ring when empty.

**Suggestion pills** adapt: no docs → generic prompts · docs in scope → "Summarize all docs", "Find contradictions", "Key takeaways" · research mode → "Key findings", "Compare sources", "Export summary".

#### Right Panel Tabs

**Document tab:**
- Docs in scope: multi-doc tab strip (when >1), then white reading surface with section nav, active context callout, document body. Active doc title + chunk count in header.
- No docs: empty state on white surface pointing to "Add doc."

**System tab:** Live hardware stats (see System Panel).

---

## System Panel

Dark stats panel. Values animate on ~1.8s interval with sine-based jitter.

**Sections:** Active Model (name mono + Tok/s + TTFT + sparkline) · GPU (arc gauge + VRAM bar + temp bar) · System RAM (total mono + bar + Ollama/Qdrant/PG breakdown) · Context Window (token count + bar + 4 mini cards: System/Docs/History/Buffer) · CPU (percentage + sparkline).

**Arc Gauge:** Pure SVG half-circle. Two `<path>` elements — track in `rgba(128,128,128,0.12)`, fill with `stroke-dasharray` driven by percentage. Colors: `< 60%` blue · `60–80%` amber · `> 80%` red.

**Sparkline:** Pure SVG `<polyline>`. Values normalized to SVG height, 1.5px colored stroke.

---

## Upload Modal — 4-Stage Flow

`backdrop-filter: blur(8px)` on overlay. Modal `border-radius: 20px`. Four small progress bars in header fill blue as you advance.

**Stage 1 — Drop:** Dashed dropzone (highlights blue on dragover) + URL import input + format pills.

**Stage 2 — Files:** File list with type badge + remove. Collection picker as color-coded buttons. Three toggles: Auto-tag / Generate summary / Sentence-aware chunking.

**Stage 3 — Processing:** Per-file animated progress bars. Spinner → green check on complete. Phase labels: `Parsing → Chunking → Generating embeddings`. Mono percentage.

**Stage 4 — Done:** Green check circle. Files listed with chunk counts in mono. "View in Library" primary button.

---

## Motion & Animation

All transitions: `cubic-bezier(0.4, 0, 0.2, 1)`. Never `linear`.

| Name | Definition | Usage |
|---|---|---|
| `fadeUp` | opacity 0→1, translateY 6→0px, 0.25s | Page entry, row reveals, modal content |
| `scaleIn` | scale 0.97→1, opacity 0→1, 0.18s | Modal open, dropdown appear |
| `blink` | opacity 0.2→1→0.2, 1.2s, staggered | Typing indicator dots |
| `shimmerPulse` | opacity 0.5→1→0.5, 2s | Live status dots (Running, Scraping) |
| `spin` | rotate 360°, 1s linear | Processing spinners |
| Sidebar | `width` 0.22s cubic | Expand/collapse |
| Progress | `width` 0.4s ease | Upload bars, stat bars |
| Send button | `background` 0.15s | Active/inactive state |

**Stagger:** `animationDelay: index * 0.03–0.05s` on list entries.

---

## Scrollbar

```css
::-webkit-scrollbar       { width: 3px; height: 3px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.25); border-radius: 3px; }
```

---

## Key Design Rules

### Do
- Use `var(--token)` for all colors — no raw hex ever
- Use `--font-wordmark` (Cormorant Garamond) only for the "Athena" brand name in the sidebar
- Use `--font-ai-msg` (Lora) only for AI response bubbles — gives the AI a distinct voice
- Use `--fm` (JetBrains Mono) for all technical values: sizes, speeds, counts, IDs, type badges
- Keep blur/glass only for modal overlays — never tables, nav, panels, or sidebars
- Give selected table rows a `2px left inset shadow` in `var(--blue)`
- Thread collection accent colors consistently: sidebar dots → folder tree → table rows
- Keep the sidebar on `var(--floor)` — no elevation, no border-radius, it's part of the chrome
- Use `border-radius: 22px` on the content panel with the full `var(--panel-shadow)` stack
- Show empty states with clear next-step guidance when a pane has no content
- Adapt suggestion pills to the current context (no docs / docs loaded / research mode)
- Activate the send button (blue) only when input has content

### Don't
- Use `backdrop-filter` blur anywhere except modal overlays
- Use `--font-wordmark` (Cormorant) for anything other than the brand name
- Use `--font-ai-msg` (Lora) for interface chrome — only AI response text
- Use `--fb` (Poppins/body font) for AI responses — Lora only
- Use more than one accent color per surface
- Navigate to a new route for detail views — use toggleable panels
- Add decorative gradients or glows to utility views (library, table)
- Show an active send button when the input is empty

---

## Stack Reference

| Layer | Technology |
|---|---|
| Framework | React + TypeScript |
| Styling | CSS custom properties (theme tokens) |
| Icons | Lucide React — thin custom `Ic` wrapper |
| Animation | CSS keyframes (`fadeUp`, `scaleIn`, `blink`, `shimmerPulse`, `spin`) |
| Fonts | Cormorant Garamond (wordmark) · Plus Jakarta Sans + Poppins (editorial) · Playfair Display (serif display) · Lora (serif body + AI messages) · JetBrains Mono (technical values) |
| Data viz | Pure SVG — arc gauges (`stroke-dasharray`) and sparklines (`<polyline>`) |
| Dropdowns | Absolute position, `mousedown` outside-click handler to close |
