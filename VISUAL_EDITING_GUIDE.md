# Visual Editing Guide for Ghosted

This project is best edited with a browser and code editor side by side:

1. Run the local server.
2. Open the page in Chrome or Edge.
3. Use DevTools to visually test changes.
4. Copy the winning changes into the real HTML and CSS files.
5. Refresh and repeat.

That is the fastest way to both improve the site and learn how HTML and CSS actually work.

## Best Approach for This Repo

For Ghosted, the best learning workflow is:

- Use `python server.py` to run the site locally.
- Use Chrome or Edge DevTools for visual editing.
- Save permanent changes in the actual source files.
- Treat visual builders like Pinegrow as optional helpers, not the main workflow.

Why this is the best fit here:

- The site is mostly plain HTML, CSS, and JavaScript.
- The main marketing page is easy to inspect directly.
- You can see exactly which class controls which visual detail.
- You learn real CSS selectors, layout, spacing, colors, and responsive behavior instead of learning a tool-specific UI first.

## Files You Will Edit Most

Main public landing page:

- `C:\Users\Smirk\Ghosted\index.html`
- `C:\Users\Smirk\Ghosted\styles.css`
- `C:\Users\Smirk\Ghosted\site.js`

Other important pages:

- `C:\Users\Smirk\Ghosted\design\index.html`
- `C:\Users\Smirk\Ghosted\design\styles.css`
- `C:\Users\Smirk\Ghosted\app\index.html`
- `C:\Users\Smirk\Ghosted\app\app.css`

## Recommended Setup

Use these tools together:

- VS Code for editing files
- Chrome DevTools or Edge DevTools for visual testing
- The local Python server for real-page previews

Start the site with:

```powershell
python server.py
```

Then open:

```text
http://localhost:8000
```

## Best Learning Loop

Use this loop every time:

1. Inspect the element on the page.
2. Find the class name in DevTools.
3. Change styles live in the Styles panel.
4. Watch what happens immediately.
5. When it looks better, copy that change into the real file.
6. Refresh and confirm it still works.

This teaches faster because you get:

- instant visual feedback
- direct connection between markup and styling
- repeated practice with real selectors and properties

## What To Learn First

Focus on these HTML concepts first:

- semantic structure like `header`, `main`, `section`, `nav`, `button`, `a`
- classes and how they connect HTML to CSS
- nesting and content grouping

Focus on these CSS concepts first:

- spacing with `margin`, `padding`, and `gap`
- sizing with `width`, `max-width`, `min-height`
- layout with `display: flex` and `display: grid`
- typography with `font-size`, `line-height`, and `font-family`
- colors, borders, shadows, and background layers
- responsive design with media queries and `clamp()`

## How To Read This Project's CSS

`styles.css` is organized with layers:

- `@layer tokens`
- `@layer base`
- `@layer layout`
- `@layer components`
- `@layer utilities`

That means you should usually learn and edit in this order:

1. Tokens: colors, spacing, radii, fonts, shared variables
2. Base: page-wide element defaults
3. Layout: containers and section structure
4. Components: buttons, cards, nav, hero blocks
5. Utilities: small helper classes

A strong beginner-friendly habit is:

- change variables in `:root` when you want system-wide visual updates
- change component classes when you want one part of the page to look different

## Good First Edits

Start with low-risk changes that teach the most:

- change a heading size
- adjust section spacing
- tweak button colors
- change card border radius
- edit hero text width
- test mobile spacing in responsive mode

These give quick wins without breaking structure.

## Best DevTools Features To Use

Use these constantly:

- Inspect element picker
- Styles panel
- Computed panel
- Box model view
- Device toolbar for mobile layouts
- Elements panel for small HTML text changes

Especially useful for learning:

- toggle CSS properties on and off
- change numbers with arrow keys
- test `padding`, `margin`, `gap`, `flex`, and `grid`
- see which rule is winning in the cascade

## When Pinegrow Helps

This repo includes `pinegrow.json`, so Pinegrow can still be useful for:

- visually selecting blocks
- rearranging sections
- making quick content edits
- exploring structure if you prefer a design-tool feel

But it should be your secondary tool, not your primary learning tool.

Why:

- browser DevTools shows the real rendered result
- DevTools teaches standard web skills used everywhere
- visual builders can hide the relationship between HTML, CSS, and the browser cascade

If you use Pinegrow, treat it like a layout assistant and still review the generated or edited code in the real files afterward.

## A Simple Weekly Practice Plan

If you want to learn while improving the site, do this:

Day 1:

- inspect the homepage hero
- identify the classes that control spacing and text

Day 2:

- change button styles and hover states
- learn `padding`, `border`, `background`, `transition`

Day 3:

- edit one section layout with flex or grid
- learn `justify-content`, `align-items`, `gap`, `grid-template-columns`

Day 4:

- test tablet and mobile sizes
- learn `clamp()`, breakpoints, wrapping, and stacking

Day 5:

- rebuild one small block from scratch in HTML and CSS
- compare your version to the current implementation

## Practical Rules To Follow

- Make one small visual change at a time.
- Keep DevTools open while editing.
- Do not trust a visual change until you refresh and re-test it.
- Check desktop and mobile before calling a change done.
- If you do not understand a property, look up only that property and test it immediately.

## Short Recommendation

If your goal is to visually edit the site and learn at the same time, use:

- browser DevTools as the main visual editor
- VS Code as the permanent editor
- Pinegrow only as an optional helper

That combination gives the most learning, the least confusion, and the best control over this codebase.
