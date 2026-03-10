# Athena — UI Design Vision & System Reference

> A document for recreating the Athena frontend aesthetic, component patterns, and interaction flows. Intended as a handoff reference for any LLM or developer building new views within this system.

---

## Design Philosophy

The aesthetic is called **Structural Glass** — a fusion of two distinct visual languages:

1. **Structural Minimalism** (inspired by dense SaaS data tools): crisp dark surfaces, high-contrast typography, information-dense tables, zero decorative effects on utility views.
2. **Liquid Glass** (reserved for AI/chat surfaces only): subtle translucency, soft borders, atmospheric depth — used *only* where it communicates that the user is interacting with an AI system.

**The core rule:** Glass effects belong on chat bubbles, AI panels, and modals. They do not belong on tables, file lists, folder trees, or navigation.

---

## Layout Architecture

The app uses a **two-layer depth model**:

```
┌─────────────────────────────────────────────────────────┐
│  FLOOR  (#070709) — raw dark background                  │
│                                                          │
│  ┌─────────┐  ┌────────────────────────────────────┐    │
│  │ SIDEBAR │  │  CONTENT PANEL                     │    │
│  │         │  │  background: #0d0d11               │    │
│  │ sits on │  │  border-radius: 22px               │    │
│  │  floor  │  │  box-shadow: ring + depth          │    │
│  │         │  │  margin: 10px (floats above floor) │    │
│  └─────────┘  └────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

The sidebar lives directly on the floor — no border-radius, no elevation. The main content panel has `border-radius: 22px`, a 1px highlight ring (`rgba(255,255,255,0.055)`), and a deep drop shadow (`0 4px 40px rgba(0,0,0,0.55)`). This creates a clear "content is floating on top" feeling without any blur or glass effects on the panel itself.

---

## Color Tokens

```css
:root {
  /* Depth layers */
  --floor:     #070709;          /* Page background, sidebar bg */
  --surface:   #0d0d11;          /* Main content panel */
  --surface-2: #121217;          /* Inset wells, modal bodies */

  /* Interactive surfaces */
  --raised:    rgba(255,255,255,0.038);   /* Default card/row bg */
  --raised-h:  rgba(255,255,255,0.062);   /* Hover state */
  --raised-a:  rgba(255,255,255,0.090);   /* Active/selected state */

  /* Borders */
  --border:    rgba(255,255,255,0.072);   /* Default border */
  --border-s:  rgba(255,255,255,0.12);    /* Stronger border (modals, focus) */

  /* Text */
  --t1: rgba(255,255,255,0.90);   /* Primary */
  --t2: rgba(255,255,255,0.52);   /* Secondary */
  --t3: rgba(255,255,255,0.28);   /* Tertiary / metadata */
  --t4: rgba(255,255,255,0.13);   /* Disabled / labels */

  /* Accent */
  --blue:      #3b7cf4;
  --blue-a:    rgba(59,124,244,0.13);   /* Blue tinted bg */
  --blue-b:    rgba(59,124,244,0.07);   /* Subtle blue tint */
  --blue-br:   rgba(59,124,244,0.26);   /* Blue border */

  --green:     #34d399;
  --green-a:   rgba(52,211,153,0.12);
  --green-br:  rgba(52,211,153,0.24);

  --amber:     #f59e0b;
  --amber-a:   rgba(245,158,11,0.12);
  --amber-br:  rgba(245,158,11,0.24);

  --red:       #f87171;
  --red-a:     rgba(248,113,113,0.12);
  --red-br:    rgba(248,113,113,0.24);

  --purple:    #a78bfa;
  --purple-a:  rgba(167,139,250,0.11);
}
```

**Never use raw hex values in components.** Always reference these tokens.

---

## Typography

| Role | Size | Weight | Notes |
|---|---|---|---|
| Page title | 15px | 700 | `letter-spacing: -0.02em` |
| Section header | 13px | 600 | — |
| Body / table content | 13px | 400 | `line-height: 1.65` |
| Small label / meta | 11–12px | 400–500 | `color: var(--t2)` or `--t3` |
| Section category label | 10px | 700 | `uppercase, letter-spacing: 0.08em, color: var(--t4)` |
| Monospace values | 11–14px | 400–600 | JetBrains Mono, used for: file sizes, token counts, percentages, model names, stat values |

**Fonts:** `Inter` for all UI text. `JetBrains Mono` for technical values, file sizes, chunk counts, tok/s, TTFT, VRAM numbers, and file type badges.

---

## Component Patterns

### Sidebar

- Collapsible between `220px` (expanded) and `56px` (collapsed)
- Transition: `width 0.22s cubic-bezier(0.4,0,0.2,1)`
- In collapsed mode: labels fade to `opacity: 0`, badges hide, icons center
- Contains: logo, primary nav (3 items), collections list with color dots, settings, user avatar
- Background: `var(--floor)` — no elevation, no border-radius
- Toggle button: small chevron button in the header row, flips direction

**Collection dots:** Each collection has a unique accent color represented as a `7x7px` square with `border-radius: 2px`. Colors are consistent across sidebar, file rows, and folder trees (blue, purple, green, amber).

### Nav Items

```css
.nav-item {
  padding: 7px 9px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--t3);
  transition: background 0.12s, color 0.12s;
}
.nav-item:hover  { background: rgba(255,255,255,0.05); color: var(--t2); }
.nav-item.active { background: rgba(255,255,255,0.07); color: var(--t1); }
```

### Content Panel (Elevated Card)

```css
.panel {
  flex: 1;
  margin: 10px 10px 10px 0;
  background: var(--surface);
  border-radius: 22px;
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.055),
    0 4px 40px rgba(0,0,0,0.55),
    0 1px 0 rgba(255,255,255,0.035) inset;
  overflow: hidden;
}
```

### File Type Badges

Compact badges for PDF and Markdown file types:

```
Width: 28px, Height: 28px, border-radius: 7px
PDF  → background: rgba(248,113,113,0.1), border: rgba(248,113,113,0.22), color: var(--red)
MD   → background: rgba(59,124,244,0.1),  border: rgba(59,124,244,0.22),  color: var(--blue)
Font: JetBrains Mono, 8.5px, weight 700
```

### Pill Tags

```css
.pill {
  padding: 3px 9px;
  border-radius: 100px;
  font-size: 11px;
  font-weight: 500;
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

- **Ghost:** `background: var(--raised), border: var(--border), color: var(--t2)`
- **Primary:** `background: var(--blue), color: white`
- **Danger:** `background: var(--red-a), border: var(--red-br), color: var(--red)`
- Border-radius: `9px`
- Font size: `12.5px`, weight `500`
- Gap between icon and label: `6px`

### Table / File Rows

```css
.trow {
  display: grid;
  padding: 10px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.042);
  cursor: pointer;
  transition: background 0.1s;
}
.trow:hover    { background: var(--raised-h); }
.trow.selected { background: var(--raised-a); box-shadow: inset 2px 0 0 var(--blue); }
```

- No outer border on the table container — rows are self-contained with a bottom divider
- Selected rows get a `2px blue left inset shadow` as the selection indicator
- Column headers: `11px, weight 600, color: var(--t4), letter-spacing: 0.04em`

### Progress Bars

```css
.prog-bar  { height: 3px; border-radius: 2px; background: var(--border); overflow: hidden; }
.prog-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }
```

Color logic:
- `< 65%` → `var(--blue)`
- `65–85%` → `var(--amber)`
- `> 85%` → `var(--red)`

### Status Badges

Small pill with dot + label:
```
Indexed    → background: var(--green-a), border: var(--green-br), color: var(--green)
Processing → background: var(--amber-a), border: var(--amber-br), color: var(--amber)
Error      → background: var(--red-a),   border: var(--red-br),   color: var(--red)
border-radius: 100px, font-size: 11px
```

---

## Views

### Library View

**Layout:** Two-pane inside the content panel.

**Left pane (220px):** Folder/collection tree with collapsible subfolders, color dot per collection, tag section below a divider. Same visual language as the sidebar — subordinate navigation.

**Right pane (flex: 1):** File table with tab filter row (All Files / PDF / Markdown / Web), column headers, and borderless file rows. Columns: Name (with type badge), Collection (with color dot), Added, Size.

**Header:** Page title + subtitle, search input, Import button (triggers upload modal).

**Collection dots** thread through both sidebar and table rows for visual continuity.

### Research View

**Layout:** Three-column split inside the content panel.

**Left (~400px):** AI chat panel — dark background, document scope pills in header, AI reasoning steps (checklist with green checkmarks), section reference chips in JetBrains Mono (`§2.1`, `§3.2`), AI response card with inline quoted blocks, suggestion pills above input.

**Right (flex: 1):** Toggleable panel with two modes, selected via tab bar at the top:

1. **Document tab** — white/off-white (`#f9f9f7`) document reader. Section navigation pills in a sticky toolbar. Active context highlighted with a blue left-border callout block. Clean serif-like typography in dark ink on light background. The contrast between dark AI panel and light doc panel is intentional.

2. **System tab** — dark system health dashboard with:
   - Active model name (mono), live **tok/s** and **TTFT** as large mono numbers, sparkline graph
   - GPU utilization as a **half-circle arc gauge** (SVG), VRAM usage bar, temperature bar
   - System RAM breakdown (Ollama / Qdrant / PG / Other) with a stacked progress bar
   - **Context window** usage with 4-part breakdown: System / Docs / History / Buffer — shown as mini stat cards
   - CPU utilization with sparkline
   - Stats animate on a slow interval to feel live without being distracting

**AI message anatomy:**
```
[Avatar 26x26 gradient icon]
  ├── Reasoning steps (checklist, green checks, --t3 text)
  │     └── Section ref chips (mono, blue tint)
  └── Response card (var(--raised) bg, border, rounded 4px 13px 13px 13px)
        ├── Paragraph text (13px, --t1, lineHeight 1.68)
        ├── Quote block (blue left border, italic, --t2)
        └── Tag pills footer (separated by top border)

User message: right-aligned, blue-tinted bg, rounded 13px 13px 4px 13px
```

### Chat View

Single-pane chat. Same message anatomy as Research. Header shows model status (green dot, model name), document scope pills. Input has suggestion pills below it. Typing indicator is three animated dots.

---

## Upload Modal — 4-Stage Flow

The modal uses `backdrop-filter: blur(8px)` on the overlay and `border-radius: 20px` on the modal card. This is one of the few places blur is used — it's appropriate because the modal is a full-focus interruption, not a utility surface.

### Stage 1: Drop
- Large dashed dropzone (`border: 2px dashed`) with upload icon, label, and subtitle
- URL import input below the dropzone
- Supported format pills: PDF, Markdown, DOCX, TXT, HTML, YouTube URL, Web page
- Drop zone highlights (blue tint + border-color change) on `dragover`

### Stage 2: Files
- File list with type badge, name, size, remove button
- **Collection picker:** color-coded buttons, selected state uses collection's accent color for border + background tint
- **Indexing options:** three toggles (Auto-tag with AI / Generate summary / Sentence-aware chunking) styled as iOS-style toggle switches

### Stage 3: Processing
- Per-file progress bars with animated fill
- Status label updates by phase: `Parsing → Chunking → Generating embeddings → Finalizing`
- File icon swaps to green checkmark on completion
- Percentage counter in mono

### Stage 4: Done
- Large green check icon in a tinted card
- Summary: "3 documents imported · added to [Collection] · N chunks indexed"
- File confirmation list with green checkmarks
- Actions: "Import more" (ghost) + "View in Library" (primary)

---

## Motion & Animation

All transitions use `cubic-bezier(0.4, 0, 0.2, 1)`. Never `linear`.

| Animation | Keyframe | Usage |
|---|---|---|
| `fadeUp` | opacity 0→1 + translateY 6px→0, 0.25s | Page entry, row reveals, modal content |
| `scaleIn` | scale 0.96→1 + opacity 0→1, 0.2s | Modal open, dropdown appears |
| `shimmer` | gradient sweep 1.5s loop | Loading skeletons |
| `blink` | opacity 0.2→1→0.2, 1.2s loop, staggered | Typing indicator dots |
| Sidebar collapse | `width` transition, 0.22s cubic | Sidebar expand/collapse |
| Progress bars | `width` transition, 0.4s ease | Upload progress, system stats |

**Stagger:** List entries use `animationDelay: index * 0.03s` with `fadeUp`.

---

## Data Visualization (System Panel)

### Arc Gauge (GPU / CPU utilization)

Pure SVG half-circle arc. Two concentric `<path>` elements traced along the same arc — one as track (`rgba(255,255,255,0.07)`), one as fill (colored, with `stroke-dasharray` driven by percentage). Rotated so 0° starts at the left.

Color thresholds: `< 60%` → blue · `60–80%` → amber · `> 80%` → red

### Sparkline

Pure SVG `<polyline>`. Input is an array of numbers, normalized to the SVG height. Used for GPU utilization history and CPU history.

---

## Scrollbar

```css
::-webkit-scrollbar       { width: 3px; height: 3px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 3px; }
```

---

## Key Design Rules (Do / Don't)

### ✅ Do
- Use `var(--token)` for all colors — no raw hex
- Keep glass/blur effects for AI surfaces and modal overlays only
- Use JetBrains Mono for all technical values (sizes, speeds, counts, percentages, IDs)
- Give selected table rows a `2px left inset shadow` in blue
- Use collection accent colors consistently across sidebar dots, table dots, and folder cards
- Keep section category labels at `10px / 700 / uppercase / 0.08em tracking / var(--t4)`
- Animate stats with a slow jitter (1.5–2s interval) so they feel live but not distracting
- Keep the sidebar on the raw floor — it should feel like it's part of the chrome, not a panel
- Use `border-radius: 22px` on the main content panel with the full shadow stack

### ❌ Don't
- Use backdrop-filter blur on tables, file lists, nav items, or the sidebar
- Use colored backgrounds on the sidebar (it lives on `var(--floor)`, no fill)
- Use more than one accent color per surface — one blue highlight per view
- Navigate to a new route for detail views — use slide-in panels or toggleable panes
- Use `text-white` or `bg-black` directly — use tokens
- Use Inter for technical values — always JetBrains Mono
- Add decorative gradients or glows to utility views (library, documents table)

---

## Stack Reference

| Layer | Technology |
|---|---|
| Framework | React + TypeScript |
| Styling | Tailwind CSS + CSS custom properties (HSL tokens) |
| Icons | Lucide React (`size`, `strokeWidth` props) |
| Animation | CSS keyframes + Framer Motion (spring physics for panel reveals) |
| Fonts | Inter (UI) · JetBrains Mono (technical values) |
| Charts | Pure SVG (arc gauges, sparklines) — no chart library needed |
