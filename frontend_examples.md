# Athena â€” Liquid Glass Design System
### v2.0 Â· Developer & LLM Handoff Reference

> A minimal, hyper-modern aesthetic bridging Apple VisionOS and Swiss editorial design. Built on glassmorphism, semantic tokens, and fluid motion. **This document reflects the live implementation** â€” treat it as the source of truth for all new components.

---

## Stack

| Layer | Tool |
|---|---|
| Framework | React + TypeScript |
| Styling | Tailwind CSS + CSS Custom Properties (HSL tokens) |
| Icons | Lucide React |
| Animation | CSS keyframes + Framer Motion (`motion/react`) for spring-based interactions |
| Fonts | Inter (UI) Â· JetBrains Mono (code/values) |

---

## Design Principles

**Material: Liquid Glass**
Surfaces feel like thick high-index glass with varying blur (20â€“60px) and subtle refraction. Never flat plastic. `backdrop-filter` is the primary tool â€” always pair with `-webkit-backdrop-filter` for Safari.

**Atmosphere: Breathable**
White space is structural, not decorative. When in doubt, add more breathing room rather than less.

**Depth via Z-Axis**
Elevation = `box-shadow` + `backdrop-filter`. Three tiers: subtle, default, strong. Never mix tiers on the same elevation level.

**Interaction: Reveal, Don't Navigate**
Complex detail views (e.g. node inspector, document viewer) slide in as side panels over the current view rather than navigating to a new route. Use spring physics, not linear easing.

---

## Color Tokens

**Rule: Never use raw hex or rgb in components. Always use `hsl(var(--token))`.**

### Core Semantic

| Token | Usage |
|---|---|
| `hsl(var(--background))` | Page background |
| `hsl(var(--foreground))` | Primary text |
| `hsl(var(--card))` | Card surfaces |
| `hsl(var(--border))` | Dividers |
| `hsl(var(--muted))` | Subtle backgrounds |
| `hsl(var(--muted-foreground))` | Secondary text, captions |
| `hsl(var(--input))` | Input borders |

### Brand

| Token | Name | Notes |
|---|---|---|
| `hsl(var(--primary))` | Electric Blue `#007AFF` | Main brand color â€” use sparingly |
| `hsl(var(--primary-foreground))` | White | Text on primary backgrounds |
| `hsl(var(--accent))` | Emerald | Success, online status, confirmations |
| `hsl(var(--destructive))` | Red | Errors, destructive actions |

### Inline-Only Tokens (No CSS Variable)

Some states use inline `style` because they are contextual or not yet tokenized. Prefer tokenizing as the system matures.

| Purpose | Value | Where used |
|---|---|---|
| Warning / Pending | `hsl(38 90% 55%)` | Research session "Awaiting Approval" badge |
| Warning background | `hsl(38 90% 55% / 0.12)` | Same badge background |
| Emerald direct | `hsl(142 65% 45%)` | RAM progress bar fill, quiz correct state |

> **TODO:** Promote warning to `--warning` and `--warning-foreground` tokens to eliminate these inline usages.

### Glass Tokens

| Token | Usage |
|---|---|
| `hsl(var(--glass-bg))` | Glass surface fill |
| `hsl(var(--glass-border))` | Glass edge border |
| `--glass-blur` | CSS variable = `40px` (override per tier) |
| `hsl(var(--orb-1/2/3))` | Background ambient orbs |

### Dark Mode

Dark mode is **forced on mount** via JS and stored in `localStorage` as `athena-theme`. Default is always `dark`.

```ts
// In root component useEffect:
document.documentElement.classList.add("dark");
localStorage.setItem("athena-theme", "dark");
```

---

## Typography

Font: **Inter** Â· Fallback: `-apple-system, sans-serif`
Mono: **JetBrains Mono** â€” use `.mono` class for all code, model names, technical values. Note: `.mono` carries `opacity: 0.8`.

| Role | Tailwind Classes | Size | Weight |
|---|---|---|---|
| Display | `text-5xl font-extrabold tracking-tight` | 48px | 800 |
| Heading 1 | `text-3xl font-bold tracking-tight` | 30px | 700 |
| Heading 2 | `text-xl font-semibold` | 20px | 600 |
| Panel Title | `text-base font-semibold` | 16px | 600 |
| Section Header | `text-sm font-semibold` | 14px | 600 |
| Body | `text-sm leading-relaxed` | 14px | 400 |
| Caption / Label | `text-xs text-muted-foreground` | 12px | 400 |
| Micro Label | `text-[10px] font-bold uppercase tracking-wider` | 10px | 700 |
| Mono | `.mono` (JetBrains Mono, opacity 0.8) | 14px | 400 |

---

## Glass Utilities

Three tiers. Choose by Z-axis elevation. Never mix tiers on the same level.

| Class | Opacity | Blur | Saturation | Use Case |
|---|---|---|---|---|
| `.glass-subtle` | 20% | 20px | 140% | Nav hover, suggestion pills, nested wells, stat badges |
| `.glass` | 45% | 40px | 160% | Chat window, panels, research cards, default surfaces |
| `.glass-strong` | 65% | 60px | 180% | Sidebar, modals, collapse toggle button |

### Hover Interaction â€” `.glass-hover`

Attach to any interactive glass element. Provides: translucency increase, primary-blue border glow, `translateY(-1px) scale(1.002)`.

```css
.glass-hover {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.glass-hover:hover {
  background: hsl(var(--glass-bg) / 0.65);
  border-color: hsl(var(--primary) / 0.3);
  box-shadow: 0 0 0 1px hsl(var(--primary) / 0.1), 0 8px 32px hsl(var(--primary) / 0.08);
  transform: translateY(-1px) scale(1.002);
}
```

---

## Background Orbs

Every page uses **three** ambient gradient orbs fixed in the background. Always `pointer-events-none`, `aria-hidden`, behind all content (`fixed inset-0`).

```tsx
<div className="fixed inset-0 pointer-events-none" aria-hidden>
  {/* Orb 1 â€” top left â€” primary blue */}
  <div
    className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-3xl"
    style={{
      background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)",
      top: "-10%", left: "-5%",
    }}
  />
  {/* Orb 2 â€” bottom right â€” purple */}
  <div
    className="absolute w-[500px] h-[500px] rounded-full opacity-15 blur-3xl"
    style={{
      background: "radial-gradient(circle, hsl(260 60% 55%) 0%, transparent 70%)",
      bottom: "0%", right: "0%",
    }}
  />
  {/* Orb 3 â€” center â€” emerald */}
  <div
    className="absolute w-[300px] h-[300px] rounded-full opacity-10 blur-3xl"
    style={{
      background: "radial-gradient(circle, hsl(142 65% 45%) 0%, transparent 70%)",
      top: "50%", left: "40%",
    }}
  />
</div>
```

**Opacity caps:** Orb 1 â‰¤ `opacity-20`, Orb 2 â‰¤ `opacity-15`, Orb 3 â‰¤ `opacity-10`. Never exceed.

---

## Layout

### App Shell

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  <aside>  z-20          â”‚  <main>  z-10              â”‚
â”‚  glass-strong           â”‚  flex flex-col h-full       â”‚
â”‚  sidebar                â”‚                             â”‚
â”‚  w-[220px] / w-[68px]   â”‚  <header> glass-subtle      â”‚
â”‚  collapsible            â”‚  border-b border-border/30  â”‚
â”‚  transition 300ms       â”‚                             â”‚
â”‚                         â”‚  <content area>             â”‚
â”‚                         â”‚  flex-1 overflow-hidden     â”‚
â”‚                         â”‚  p-4 md:p-6                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Z-Index Scale

| Layer | z-index | Element |
|---|---|---|
| Base content | `z-10` | Main area |
| Sidebar | `z-20` | Aside |
| Collapse toggle | `z-30` | Sidebar toggle button |
| Sticky headers | `z-30` | Page headers |
| Modals / Overlays | `z-40` | Dialogs, drawers |

### Page Header Pattern

The main content header uses `glass-subtle` (not `glass-strong`).

```tsx
<header className="flex items-center justify-between px-6 py-4 border-b border-border/30 flex-shrink-0 glass-subtle">
  <div>
    <h2 className="text-base font-semibold text-foreground">{title}</h2>
    <p className="text-xs text-muted-foreground">{subtitle}</p>
  </div>
  <div className="flex items-center gap-2">
    {/* right-side actions */}
  </div>
</header>
```

---

## Components

### Sidebar

Collapsible between `w-[220px]` (expanded) and `w-[68px]` (collapsed). Transition: `300ms cubic-bezier(0.4,0,0.2,1)`.

The collapse toggle is an absolutely-positioned button at `-right-3 top-20`:

```tsx
<button
  onClick={() => setSidebarCollapsed(v => !v)}
  className="absolute -right-3 top-20 w-6 h-6 rounded-full glass-strong border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-30"
>
  {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
</button>
```

Sidebar sections from top to bottom:
1. Logo + app name (`text-sm font-bold`, subtitle `text-xs text-muted-foreground`)
2. Status badge (`glass-subtle rounded-xl`) with `.status-online` dot + model name in `.mono`
3. Nav items (scrollable `flex-1`)
4. Resource monitor (VRAM + RAM progress bars, hidden when collapsed)
5. Bottom row: Style Guide link + `<ThemeToggle />`

---

### Navigation Items

```css
.nav-item {
  @apply flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium;
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
  color: hsl(var(--muted-foreground));
}
.nav-item:hover {
  background: hsl(var(--glass-bg) / 0.6);
  color: hsl(var(--foreground));
}
.nav-item.active {
  background: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary));
  box-shadow: inset 0 0 0 1px hsl(var(--primary) / 0.2);
}
```

Note: Active state uses inset box-shadow ring â€” **not** a left border.

---

### Buttons

| Variant | Class / Pattern | Rule |
|---|---|---|
| Primary Glow | `.btn-glow` | **One per view max** |
| Ghost Glass | `glass-subtle glass-hover rounded-full border` | Secondary actions |
| Accent / Success | `glass-subtle` + `text-accent border-accent/20` | Confirmations |
| Disabled | `opacity-40 cursor-not-allowed disabled:shadow-none disabled:transform-none` | Unavailable |

```css
.btn-glow {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-radius: 9999px;
  box-shadow: 0 0 20px hsl(var(--primary) / 0.4), 0 4px 12px hsl(var(--primary) / 0.3);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.btn-glow:hover {
  box-shadow: 0 0 30px hsl(var(--primary) / 0.6), 0 6px 20px hsl(var(--primary) / 0.4);
  transform: scale(1.02);
}
```

Always add `disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none` to `.btn-glow` buttons.

---

### Chat Bubbles

Never center-align. User right, AI left.

```css
.message-user {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-radius: 1.25rem 1.25rem 0.25rem 1.25rem; /* round all except bottom-right */
}
.message-ai {
  background: hsl(var(--glass-bg) / 0.6);
  backdrop-filter: blur(20px);
  border: 1px solid hsl(var(--glass-border) / 0.5);
  border-radius: 1.25rem 1.25rem 1.25rem 0.25rem; /* round all except bottom-left */
  color: hsl(var(--foreground));
}
```

AI messages include a header row: `w-5 h-5 rounded-full bg-primary` with a `<Sparkles size={10} />` icon + `"Athena"` label in `text-xs text-muted-foreground font-medium`.

AI messages optionally render source pill badges below:
```tsx
<span className="text-xs px-2 py-0.5 rounded-full glass-subtle text-muted-foreground">
  ðŸ“„ {sourceName}
</span>
```

---

### Input Pill

```css
.input-pill {
  background: hsl(var(--glass-bg) / 0.6);
  backdrop-filter: blur(30px) saturate(160%);
  -webkit-backdrop-filter: blur(30px) saturate(160%);
  border: 1px solid hsl(var(--glass-border) / 0.5);
  border-radius: 9999px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.input-pill:focus-within {
  border-color: hsl(var(--primary) / 0.5);
  box-shadow: 0 0 0 3px hsl(var(--primary) / 0.08), 0 0 30px hsl(var(--primary) / 0.1);
}
```

Internal layout: `flex items-center gap-2 px-4 py-2.5`
Left: `<Paperclip size={16} />` Â· Center: `flex-1` input Â· Right: `<Mic size={16} />` + `.btn-glow` send button

---

### Typing Indicator

Three `.typing-dot` elements. **Visible only while waiting for first token. Remove immediately when streaming starts.**

```css
.typing-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: hsl(var(--muted-foreground));
  animation: typing-bounce 1.4s ease-in-out infinite;
}
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }
```

---

### Status Badges

```tsx
// Pattern for inline status badges (when token system not used):
<span
  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full flex-shrink-0"
  style={{ color: statusColor, background: `${statusColor} / 0.12` }}
>
  {icon}
  {label}
</span>
```

Standard badge classes for tokenized variants:

| Type | Classes |
|---|---|
| Primary | `glass-subtle text-primary border border-primary/20 rounded-full text-xs px-2.5 py-1` |
| Success | `glass-subtle text-accent border border-accent/20 rounded-full text-xs px-2.5 py-1` |
| Muted | `glass-subtle text-muted-foreground border border-border/40 rounded-full text-xs px-2.5 py-1` |

---

### Status Online Dot

```css
.status-online {
  width: 8px; height: 8px; border-radius: 50%;
  background: hsl(var(--accent));
  box-shadow: 0 0 0 2px hsl(var(--accent) / 0.2), 0 0 10px hsl(var(--accent) / 0.6);
  animation: pulse-glow 2s ease-in-out infinite;
}
```

---

### Progress Bars

Used for VRAM, RAM, mastery scores, and research pipeline progress. Always pair value text color with bar fill color.

```tsx
// Container
<div className="h-1.5 rounded-full bg-muted overflow-hidden">
  {/* Fill */}
  <div
    className="h-full rounded-full transition-all duration-500"
    style={{
      width: `${value}%`,
      background: color,
      boxShadow: `0 0 8px ${color}66`,
    }}
  />
</div>
```

For active/indeterminate states (e.g. research in progress), apply `.shimmer` to the fill and set a fixed partial width.

---

### Stat Cards

```
glass-subtle rounded-xl p-4 space-y-2 glass-hover border border-border/30
```

Always include: icon (top-left), secondary text (top-right), large value, label below.

---

### Score Ring (Quiz Results)

SVG-based circular progress. Rotate container `-90deg` so 0Â° starts at top. Inner text counter-rotated `rotate-90`.

```tsx
<svg viewBox="0 0 100 100" className="w-28 h-28 score-ring -rotate-90">
  <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
  <circle
    cx="50" cy="50" r="40" fill="none"
    stroke={pct >= 80 ? "hsl(142 65% 45%)" : pct >= 60 ? "hsl(var(--primary))" : "hsl(38 90% 55%)"}
    strokeWidth="8" strokeLinecap="round"
    strokeDasharray={`${pct * 2.51} 251`}
    className="transition-all duration-1000"
  />
</svg>
```

```css
.score-ring { filter: drop-shadow(0 0 6px hsl(var(--primary) / 0.5)); }
```

---

### Slide-In Detail Panel (Knowledge Graph / Node Inspector)

When a user clicks an interactive element (graph node, document row, etc.), a detail panel slides in from the right over the current view â€” **do not navigate to a new route**.

Use Framer Motion (`motion/react`) with spring physics:

```tsx
import { motion, AnimatePresence } from "motion/react";

<AnimatePresence>
  {selectedItem && (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 20, stiffness: 100 }}
      className="w-96 border-l border-border/40 glass-strong flex flex-col overflow-y-auto absolute right-0 top-0 h-full z-20"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-0">
        <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] px-2 py-0.5 bg-primary/10 rounded-full border border-primary/20">
          {item.type}
        </span>
        <button
          onClick={() => setSelectedItem(null)}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:glass-subtle transition-colors"
        >
          <X size={16} className="text-muted-foreground" />
        </button>
      </div>

      {/* Content */}
      <div className="p-6 space-y-8">
        <h2 className="text-2xl font-bold text-foreground">{item.label}</h2>

        <section className="space-y-3">
          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Info size={12} /> Definition
          </h4>
          <p className="text-sm text-foreground/80 leading-relaxed">{item.description}</p>
        </section>

        <section className="space-y-3">
          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Sparkles size={12} /> Key Relationships
          </h4>
          {/* Relationship list items */}
          <div className="p-3 glass-subtle rounded-xl flex items-center justify-between group hover:border-primary/30 transition-colors cursor-pointer border border-border/30">
            <span className="text-xs font-medium text-foreground">{relatedNode}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">{weight}%</span>
              <ArrowRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>
        </section>

        {/* Learning gap callout */}
        <section>
          <div className="p-4 rounded-2xl" style={{ background: "hsl(38 90% 55% / 0.1)", border: "1px solid hsl(38 90% 55% / 0.3)" }}>
            <p className="text-xs font-medium" style={{ color: "hsl(38 90% 55%)" }}>
              Weak connection detected. Consider generating a quiz.
            </p>
            <button className="mt-2 text-xs font-bold flex items-center gap-1 hover:underline" style={{ color: "hsl(38 90% 55%)" }}>
              Generate Quiz <ArrowRight size={12} />
            </button>
          </div>
        </section>
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

**Panel width:** `w-96` (384px) as default. Can be `w-80` for compact contexts.
**Dismiss:** Click X button, click outside panel, or press Escape.

---

## Animations & Motion

All CSS transitions use `cubic-bezier(0.4, 0, 0.2, 1)`. Never `linear` for UI animations.
Spring-based reveals (panels, modals) use Framer Motion with `damping: 20, stiffness: 100`.

| Class | Keyframe | Use Case |
|---|---|---|
| `.animate-fade-up` | opacity 0â†’1 + translateY 12pxâ†’0, 0.4s | Page entry, card reveals, chat messages |
| `.animate-scale-in` | scale 0.95â†’1 + opacity 0â†’1, 0.3s | Chat window, modals, dropdowns, quiz panels |
| `.animate-float` | subtle Y oscillation 6s loop | Knowledge graph nodes |
| `.shimmer` | horizontal gradient sweep 1.8s loop | Skeleton loading, in-progress progress bars |
| `animate-pulse-glow` (keyframe) | glow pulse 2s loop | `.status-online` dot |

Staggered entry for lists: use `style={{ animationDelay: `${index * 0.05}s` }}` with `.animate-fade-up`.

---

## Shadows & Glows

| Token | Value | Use |
|---|---|---|
| `.shadow-glass` | `0 4px 24px rgba(0,0,0,0.06)` | Default panel elevation |
| `.shadow-glass-lg` | `0 8px 40px rgba(0,0,0,0.12)` | Modals, floating cards |
| `.shadow-glow` | `0 0 20px hsl(var(--primary)/0.4)` | Active elements, primary CTA |
| `.score-ring` | `drop-shadow(0 0 6px hsl(var(--primary)/0.5))` | SVG score rings |

---

## Border Radius Scale

| Class | Value | Use |
|---|---|---|
| `rounded-lg` | 16px | Inputs, form elements |
| `rounded-xl` | 12px | Nav items, stat cards, most interactive elements |
| `rounded-2xl` | 24px | Panels, research cards, chat window wrapper |
| `rounded-3xl` | 32px | Chat window container, large hero cards |
| `rounded-full` | 9999px | Pill buttons, input-pill, avatars, status dots, badges |

---

## Scrollbar

```css
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: hsl(var(--glass-border)); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.5); }
```

---

## ThemeToggle Component

```tsx
// glass-subtle glass-hover w-9 h-9 rounded-xl
// Shows <Sun size={16} /> in dark mode, <Moon size={16} /> in light mode
// Both icons use text-muted-foreground
// Persists to localStorage key "athena-theme"
```

---

## Usage Rules

### âœ… Do

- Use `hsl(var(--token))` for all colors
- Choose glass tier by Z-axis elevation
- Apply `.glass-hover` on interactive glass elements
- Use `cubic-bezier(0.4, 0, 0.2, 1)` for all CSS transitions
- Use Framer Motion spring (`damping: 20, stiffness: 100`) for panel reveals
- Pair `text-muted-foreground` for secondary text
- Use `border-border/30` or `border-border/40` for subtle separators
- Always include `-webkit-backdrop-filter` prefix
- Use `.mono` class for model names, percentages, code values
- Stagger list entries with `animationDelay: index * 0.05s`
- Include all three background orbs on every full-page layout

### âŒ Don't

- Use raw hex or rgb values in components
- Mix glass tiers on the same elevation level
- Use `text-white` or `bg-black` directly
- Skip `-webkit-backdrop-filter` prefix (Safari breaks)
- Use `linear` timing for animations
- Add borders without opacity (`/30` minimum)
- Use more than one `.btn-glow` per view
- Keep typing indicator visible during token streaming
- Navigate to a new route for detail views â€” use a slide-in panel instead
- Exceed orb opacity caps (20/15/10)

---

## Component Checklist for New Pages

When building a new full-page view, verify:

- [ ] Three background orbs present in root layout (not per-page)
- [ ] `glass-subtle` header with title + subtitle
- [ ] Content area: `flex-1 overflow-hidden p-4 md:p-6`
- [ ] Entry animation: `animate-fade-up` or `animate-scale-in`
- [ ] At most one `.btn-glow` visible at a time
- [ ] No raw hex values in inline styles
- [ ] `-webkit-backdrop-filter` on any custom `backdrop-filter` usage
- [ ] Slide-in panel pattern for detail views (not new routes)

---

*Athena Liquid Glass Design System Â· v2.0 Â· Built with Tailwind CSS + CSS Custom Properties + Framer Motion*