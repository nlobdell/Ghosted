# Ghosted Design Doctrine

## What this document governs

This doctrine defines how Ghosted should feel, read, and prioritize information across the current product.
It is not an architecture document and it is not a styling cheat sheet.
It is the product-facing design north star for the public site, the Hall, and operator tooling.

Ghosted is not a generic dashboard.
It is a Discord-first Old School RuneScape clan site with a public stage out front and a private Hall behind it.
The Ghostling is the visual identity system that ties those surfaces together.

---

## Product truth

Ghosted has three experience bands:

1. **Public layer** — prove the clan is alive, social, credible, and worth joining.
2. **Hall** — turn community signal into personal action, identity, and member workflow.
3. **Admin** — let operators change state safely and quickly without burying consequences.

Every design decision should strengthen that split.
Do not flatten these bands into one generic “app” aesthetic.

---

## The core doctrine

### 1. One world, two public-facing modes
The public site is the front porch.
The Hall is the inside workspace.
They should feel like the same world, but they should not behave the same way.

- The **public layer** sells momentum, belonging, and trust.
- The **Hall** sells clarity, progress, and next actions.

### 2. Ghostling is identity, not decoration
The Ghostling is not ornamental art.
It is the product’s clearest expression of personal presence.
Use it whenever the experience is about member identity, ownership, loadout, or sharing.
Do not force it into places where it distracts from operations.

### 3. Signal before archive
The first screen should answer the present-tense question of the route.
History, logs, archives, and secondary reference material come after the live signal.

### 4. One dominant module per page
Each route gets one unmistakable focal surface.
That surface may be a hero, spotlight, stat strip, game surface, featured competition, or operator workflow.
Do not let three modules compete for first place.

### 5. Quiet chrome, loud state
Navigation, wrappers, and decorative surfaces stay quiet.
Live numbers, identity, status, and next-step actions get the visual emphasis.

### 6. Public pages recruit; Hall pages direct; admin pages expose consequences
The voice, hierarchy, and interaction model must shift with the surface.

- Public pages should feel invitational and alive.
- Hall pages should feel focused and immediately usable.
- Admin pages should feel explicit, safe, and operational.

### 7. Shared primitives beat bespoke invention
Ghosted already has a design vocabulary.
Prefer extending or recombining that vocabulary over introducing one-off patterns that only make sense on a single page.

### 8. “Ghostling” is the product term
User-facing copy says **Ghostling**.
Internal code may still say “companion” where needed, but the product should not leak that implementation language.

---

## Experience-specific rules

## Public layer
The public layer exists to answer:

- What is Ghosted?
- Why does this clan feel active?
- Why should I trust it?
- How do I move from visitor to member?

### Public-layer rules
- Lead with **energy and proof**, not feature explanation.
- Show **social legitimacy** early: Discord scale, WOM tracking, roster visibility, stream presence, recent news.
- Keep the Ghostling visible where it strengthens identity and memorability.
- Let pages breathe more than Hall pages.
- Use editorial and community language, not product jargon.
- End every public route with a clear route deeper into the community: Discord, Hall, or another proof surface.

## Hall
The Hall exists to answer:

- What should I do now?
- What state belongs to me?
- What is live in the clan?
- How do I act without hunting for context?

### Hall rules
- Put the member’s state above generic clan exposition.
- Use stat strips and focused panels to collapse multiple signals into one scan path.
- Make the first screen decision-oriented.
- Treat ledger/history sections as supporting material unless the page is explicitly about audit.
- Keep the Hall grounded in the same world as the public site, but more compressed and more operational.

## Admin
Admin exists to answer:

- What change needs to happen?
- What system state matters before I act?
- What did I just affect?

### Admin rules
- Prefer explicit verbs: **Grant**, **Create**, **Refresh**, **Delete**, **Upload**, **Hide**, **Restore**, **Reorder**.
- Make side effects obvious.
- Put workflows before tables.
- Put audit and reference views after action blocks.
- Never make operator actions cute or ambiguous.

---

## Hierarchy model

Every Ghosted page should resolve into this order unless the route has a strong reason not to:

1. **Orientation** — hero, highlight, or app context that states what the page is for.
2. **Summary signal** — stat strip or a small set of high-value metrics.
3. **Primary action surface** — the thing the user came to do.
4. **Supporting context** — secondary panels, leaderboards, activity, feeds, side rails.
5. **Archive / audit** — logs, history, older items, dense tables.

### Priority tiers

#### Tier 1: Stage surfaces
These are heroes, highlights, spotlight sections, game surfaces, or admin context blocks.
They own the page.

#### Tier 2: Summary surfaces
These are stat strips and compact metrics.
They let the user orient in one glance.

#### Tier 3: Work surfaces
These are panels containing forms, actions, live lists, or interactive controls.
They should feel immediately usable.

#### Tier 4: Meta surfaces
These are history, archive, notes, and secondary feeds.
They should be visibly quieter than primary work.

---

## Visual language

### Color
Ghosted is a dark, nocturnal interface with a single purple-accent family.
That purple system is the visual glue across the whole product.

Rules:
- Use the accent family to guide attention, not to paint everything.
- Avoid introducing competing accent systems without a functional reason.
- Status colors should be sparse and reserved for real feedback states such as success, warning, or error.

### Typography
Typography already has a useful split and the design should keep honoring it:

- **Display type** for page anchors, value moments, and large identity statements.
- **Body type** for explanation, forms, and utility copy.
- **Mono / label treatment** for metadata, status labels, and compact scanning cues.

If the page hierarchy fails in grayscale, it is wrong.

### Surfaces
Ghosted uses elevated glassy panels and luminous dark backgrounds.
That does not mean everything should become a card.

Rules:
- A surface should earn its border, blur, and contrast.
- Primary panels can be richer and denser.
- Meta panels should recede.
- Whitespace and grouping should do as much work as borders.

### Motion
Motion should make the product feel alive, not busy.
The Ghostling animation is the main example.

Rules:
- Motion should reinforce presence or state.
- Motion should never be required to understand content.
- Always respect reduced-motion behavior.
- Static fallbacks must still feel intentional.

### Pixel rendering
Ghostling art should stay crisp.
Do not soften or blur pixel-driven identity assets unless the route explicitly calls for a stylized treatment.

---

## Content and naming doctrine

### Public copy
Public copy should sound like a real community talking about itself.
It should feel welcoming, current, and socially confident.

Good public language:
- clan
- hall
- dispatches
- roster
- live stream
- events
- join the clan
- enter the Hall

Avoid on public routes:
- enterprise product language
- feature-checklist copy
- internal implementation terms

### Hall copy
Hall copy should be direct and stateful.
It should answer what is true now and what the member can do next.

Good Hall language:
- balance
- active drops
- live competitions
- linked
- equipped
- unlock
- export
- recent activity

### Admin copy
Admin copy should state the action and the object with no friction.
If an operator has to interpret a poetic headline to understand what changes, the copy is wrong.

### Naming rules
- Say **Ghostling** in product copy.
- Say **Hall** for the member workspace.
- Say **public layer** or the specific route name for visitor-facing pages.
- Keep labels short enough to scan quickly.
- Use strong nouns and verbs before explanation.

---

## Component-system rules

Ghosted already has a clear primitive layer in `src/components/ui/AppUI.tsx` plus global tokens and shell behavior in `src/app/globals.css`.
Future work should build on that rather than fighting it.

### Canonical primitives

#### `AppContext`
Use for routes that need explicit orientation, breadcrumbs, and operator framing.
Best fit: admin and any future deep utility views.

#### `Highlight`
Use when a page needs a narrative stage plus a supporting stage block.
Best fit: clan overview, rewards summary, any route that needs a headline plus live-status frame.

#### `StatStrip`
Use for 3–4 fast-scanning signals with one lead value.
Do not turn it into a dumping ground for every metric on the page.

#### `Panel`
This is the core modular work surface.
Use `tier="primary"` for decision-critical modules.
Use `tier="meta"` for archive, support, or reference content.

#### `AppGrid`
Use for meaningful two-column relationships.
Do not use it to create generic equal-weight card walls.

#### `LeaderboardTable`
Use when rank order is the point.
A leaderboard should feel competitive, not like a spreadsheet.

#### `LedgerTable`
Use when auditability matters.
This is for history and receipts, not page drama.

#### `Feed`
Use for recent achievements, activity, or lightweight story streams.

#### `CompetitionList`
Use when users need a quick live/upcoming/finished scan.

#### `EmptyState` and `Banner`
These are first-class UX, not afterthoughts.
They must still move the user forward.

### Layout ownership
- `src/app/globals.css` owns tokens, shells, global primitives, and foundational interaction behavior.
- Route-level `page.module.css` files own rhythm, composition, and page-specific hierarchy.
- Route CSS may reshape a primitive’s placement.
- Route CSS should not silently redefine the primitive’s basic identity.

### Selector discipline
Use explicit class hooks on primitives.
Avoid brittle descendant-selector chains that only work because the markup happens to look a certain way today.

---

## Navigation doctrine

### Public navigation
Public navigation should stay short and confidence-building.
It is there to prove Ghosted has structure, not to expose every possible screen.

### Hall navigation
The Hall sidebar is the persistent map of the member loop.
It should emphasize the core cycle:

- Ghostling
- Rewards
- Competitions
- Clan
- Admin when relevant

Do not overload the Hall navigation with low-value destinations.
If a route is not part of the member loop, it probably does not belong in the persistent nav.

### Cross-surface links
Crossing from public to Hall should feel deliberate and valuable.
Crossing from Hall back to public should feel like stepping out to the broader world, not losing context.

---

## Route contracts

These contracts define the question each route must answer and the order in which content should appear.

## Public routes

### `/`
**Question:** What is Ghosted, and why should I care right now?

**Order:**
1. Hero and Ghostling stage
2. Social proof
3. Latest dispatches
4. Clear path to Discord or the Hall

### `/news/`
**Question:** What are the official updates and live announcements?

**Order:**
1. Featured/latest dispatch
2. Short archive preview
3. Full update list

### `/news/[slug]`
**Question:** What is the full story behind this dispatch?

**Order:**
1. Meta and back-link
2. Headline and excerpt
3. Full body

### `/roster/`
**Question:** Who is in Ghosted, and what does the clan pulse look like?

**Order:**
1. Public roster framing
2. Verified group signal and counts
3. Sort controls
4. Fast-scanning member grid
5. Pagination

### `/media/`
**Question:** Does this community feel live and replayable?

**Order:**
1. Live stream first
2. Clip and replay surfaces second

### `/about/`
**Question:** What kind of clan is this and how do I join?

**Order:**
1. Identity statement
2. Join funnel
3. Leadership/community roles

### `/privacy/` and `/terms/`
These are utility pages.
Make them readable, calm, and legally clear.
Do not overdesign them.

## Hall routes

### `/hall/`
**Question:** What should I do in Ghosted right now?

**Order:**
1. Personal spotlight / Ghostling stage
2. Stat strip
3. Immediate next-action panel
4. Live pulse and leaderboard preview
5. Recent ledger activity

### `/hall/ghostling/`
**Question:** How do I shape, unlock, and export my Ghostling identity?

**Order:**
1. Identity + export hero
2. Stat strip
3. Live studio
4. Export surfaces
5. Unlock library / cosmetic catalog

This is the strongest identity page in the product.
Treat it accordingly.

### `/hall/rewards/`
**Question:** What can I spend or enter right now?

**Order:**
1. Balance and cap summary
2. Active drops
3. Upcoming/closed drops
4. Full ledger

### `/hall/competitions/`
**Question:** What competitions are live, and where do we stand?

**Order:**
1. Competition scoreboard
2. Live/upcoming timeline
3. Featured event details
4. Featured leaderboard

### `/hall/clan/`
**Question:** How healthy and competitive is the clan right now?

**Order:**
1. Clan spotlight
2. Summary strip
3. Roster-health and leader panels
4. Events and gains
5. Achievements and activity

### `/hall/profile/`
**Question:** Is my identity and clan linkage configured correctly?

**Order:**
1. Identity and WOM-linking surface
2. Roles and perks
3. Summary strip
4. Deeper linked-state detail

### `/hall/casino/`
**Question:** Can I play now, and what are the constraints?

**Order:**
1. Game surface
2. Value/rules framing
3. Nothing that delays entry into play

## Admin routes

### `/admin/`
**Question:** What operator action matters first?

**Order:**
1. Context and breadcrumbs
2. Workflow blocks
3. Scoreboard
4. System snapshot
5. Sync/reference tables
6. Content records

### `/admin/ghostling/`
**Question:** How do I safely manage the Ghostling asset library?

**Order:**
1. Context and scoreboard
2. Base asset management
3. New-item creation
4. Existing-item replacement
5. Repo import workflow
6. Visibility and ordering controls

---

## Editing rules

When changing or creating a route, answer these questions before you design it:

1. Which surface is this: public, Hall, or admin?
2. What is the page’s one-sentence question?
3. What is the one dominant module?
4. What state is most important in the first viewport?
5. Which primitives already solve most of this problem?
6. Which sections are primary and which are meta?
7. Should the Ghostling be present here as identity, or would it be noise?
8. Does the mobile scan order preserve the same priorities as desktop?

If you cannot answer those questions, you are not ready to style the page.

---

## Anti-patterns

Do not do the following:

- Build generic SaaS dashboards that ignore Ghosted’s public/Hall split.
- Give every section equal visual weight.
- Create decorative card farms with no hierarchy.
- Use “companion” in user-facing product copy.
- Use multiple competing accent colors without a functional need.
- Hide primary actions inside tertiary panels.
- Put archives and logs above current action.
- Replace live Ghostling identity moments with static filler art.
- Invent one-off components where a shared primitive would work.
- Let admin pages become ambiguous or “themed” at the expense of clarity.
- Let public pages read like internal tools.
- Let Hall pages read like recruitment landing pages.

---

## Acceptance checklist

A change is aligned with Ghosted when all of the following are true:

- The route’s surface type is immediately obvious.
- The page question is answered in the first viewport.
- One module clearly dominates the page.
- Primary actions are visible without hunting.
- Summary metrics improve orientation instead of adding noise.
- Secondary and archive content are visibly quieter than live content.
- Ghostling appears when identity matters and stays out when it would distract.
- Product copy says **Ghostling**.
- Public pages feel alive.
- Hall pages feel actionable.
- Admin pages feel safe and explicit.
- Mobile preserves the same priority order as desktop.
- Shared primitives were reused before new ones were invented.

---

## Final rule

If a design choice makes Ghosted feel more generic, more corporate, more cluttered, or less like a real clan space, it is probably the wrong choice.

Ghosted should feel like a living community with a front stage, a private Hall, and a member identity system worth returning to.
