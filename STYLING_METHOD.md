# Styling Method: BEM

This project now standardizes on **BEM (Block, Element, Modifier)** for page styling.

## Why BEM
1. Predictable class naming for larger teams
2. Low specificity conflicts
3. Easy mapping between design intentions and CSS
4. Works cleanly with CSS Modules and shared primitives

## Naming Rules
1. `block`: standalone component (`newsCard`, `newsDetail`)
2. `block__element`: part of a block (`newsCard__meta`, `newsDetail__body`)
3. `block--modifier`: visual/behavioral variant (`app-panel--meta`, `app-stat--lead`)

## Usage In Ghosted
1. Global foundation classes stay generic in `globals.css`
2. Route-specific BEM blocks live in each `page.module.css`
3. Shared app primitives accept `className` hooks and are styled per route

## Example
```css
.newsCard {}
.newsCard__meta {}
.newsCard__title {}
.newsCard--featured {}
```

## Guardrails
1. Avoid deep descendant selectors
2. Prefer explicit block hooks over brittle global chains
3. Keep modifiers semantic (state/purpose), not presentational noise
