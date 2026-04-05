# Ghosted Design Doctrine

## Purpose
Ghosted is designed as an operational clan hall, not a generic dashboard.  
Every page should answer one core question quickly, then reveal supporting detail without visual clutter.

## Core Principles
1. Intent first.
The first viewport must answer: "What is this page for, right now?"
2. Primary beats meta.
Primary actions and live signals get more space, stronger contrast, and earlier placement than navigation or archive content.
3. Progressive disclosure.
Show immediate decisions first, secondary context second, historical data third.
4. Rhythm over card grids.
Use spacing, alignment, and typography to group meaning. Do not give unrelated content equal visual weight.
5. One dominant page pattern.
Each route has a distinct scan pattern tied to its use case.
6. Utility language.
Write labels and copy for operation and decision-making, not marketing tone.
7. Calm visual system.
Use the purple family as a single accent system; avoid competing accent colors.
8. Surfaces earn emphasis.
If a section is not interactive or decision-critical, it should not receive the same border, shadow, or contrast as a primary module.

## Cognitive Rules
1. Hick's Law: reduce simultaneous choices in each section.
2. Fitts's Law: make primary actions obvious and easy to hit.
3. Jakob's Law: keep interaction patterns familiar, while visual identity stays clan-specific.

## Design Theory Translation
1. Visual hierarchy:
Scale, contrast, and placement establish what must be read first, second, and last.
2. Proximity:
Related content is grouped tightly; unrelated content gets whitespace instead of extra chrome.
3. Common region:
Containers are used only when a group truly needs to be perceived as one decision block.
4. Alignment:
Each page uses one dominant grid so the eye can predict where primary and secondary information will land.
5. Repetition:
Shared spacing, typography, and action treatments build familiarity across routes.
6. Figure-ground:
Primary modules separate from the background through tone and spacing before using heavy borders or effects.
7. Progressive disclosure:
Immediate action and live status come first; archive, history, and meta records come later.

## Typography Rules
1. Display type is for anchors: page titles and key signals.
2. Body/system type is for utility content, forms, tables, and metadata.
3. If hierarchy fails in grayscale, hierarchy is wrong.

## Route Contracts
1. `/app` Hall
Question: "What should I do in Ghosted today?"
Order: summary signal -> live focal -> personal actions -> navigation/meta -> ledger.
2. `/app/clan`
Question: "How healthy is the clan and who is leading?"
Order: roster + leaders -> event watch + gains -> history/activity.
3. `/app/competitions`
Question: "What is live and where do we stand?"
Order: timeline/active board -> featured details -> leaderboard.
4. `/app/rewards`
Question: "What can I spend now and where?"
Order: balance + availability -> active drops -> archive -> ledger.
5. `/app/profile`
Question: "Is my identity and linking configured correctly?"
Order: identity/linking -> roles/perks -> compact status strip.
6. `/app/casino`
Question: "Can I play now and what are the constraints?"
Order: game surface first -> minimal rules/context second.
7. `/admin`
Question: "What operator action should happen first?"
Order: workflow actions -> live status signals -> sync/health -> playbook -> records.

## Implementation Rules
1. `globals.css` owns only foundation:
tokens, reset, nav shell, button primitives, typography base, accessibility/focus.
2. Route-level `page.module.css` owns hierarchy and rhythm.
3. Shared primitives stay behaviorally consistent:
`AppContext`, `StatStrip`, `Panel`, `Highlight`, `AppGrid`, `Banner`, `EmptyState`.
4. Route-specific styling should use explicit class hooks on primitives, not brittle descendant chains.

## Editing Workflow
1. Define the route question first.
2. Place one dominant first-screen module.
3. Demote supportive modules to meta weight.
4. Trim copy until headings + key values are enough to scan.
5. Validate mobile scan order before polish.

## Acceptance Checklist
1. A member can identify page purpose in under 5 seconds.
2. Primary action/module is visually dominant.
3. Secondary/meta content is clearly quieter.
4. No decorative-only modules are taking primary space.
5. Desktop and mobile scan order is consistent.
