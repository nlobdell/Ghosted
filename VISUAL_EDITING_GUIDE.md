# Visual Editing Guide for Ghosted

This project is easiest to edit with a browser and code editor side by side:

1. Run the local Next.js app
2. Open the page in Chrome or Edge
3. Use DevTools to test changes visually
4. Move the winning changes into the real source files
5. Refresh and repeat

## Best Approach for This Repo

For Ghosted, the best learning workflow is:

- Use `npm run dev` to run the site locally
- Use Chrome or Edge DevTools for visual editing
- Save permanent changes in the real Next.js source files
- Treat visual builders as optional helpers, not the main workflow

## Files You Will Edit Most

- `C:\Users\Smirk\Ghosted\src\app`
- `C:\Users\Smirk\Ghosted\src\components`
- `C:\Users\Smirk\Ghosted\src\app\globals.css`
- `C:\Users\Smirk\Ghosted\src\lib`

## Recommended Setup

Use these tools together:

- VS Code for editing files
- Chrome DevTools or Edge DevTools for visual testing
- The local Next.js dev server for real-page previews

Start the site with:

```powershell
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Practical Rules To Follow

- Make one small visual change at a time
- Keep DevTools open while editing
- Do not trust a visual change until you refresh and re-test it
- Check desktop and mobile before calling a change done
- If you do not understand a property, look up only that property and test it immediately

## Short Recommendation

If your goal is to visually edit the site and learn at the same time, use:

- browser DevTools as the main visual editor
- VS Code as the permanent editor
- optional visual builders only as helpers

That combination gives the best control over the actual Next.js app you are shipping.
