# Contributing Workflow

This repo uses a **small-PR, rebase-first workflow** to reduce merge conflicts.

## Branching Rules
- Keep `main` deployable.
- Do not commit directly to `main`.
- Create short-lived feature branches from `main`:
  - `feat/hero-refresh`
  - `feat/recruitment-panel`

## Daily Git Routine
```bash
git checkout main
git pull --ff-only origin main
git checkout -b feat/your-change
# ...make changes...
git add .
git commit -m "Describe your change"
git fetch origin
git rebase origin/main
```

If rebase conflicts appear:
```bash
# fix files
git add <resolved files>
git rebase --continue
```

## Open a PR
- Keep PR scope small (one theme/feature per PR).
- Fill in `.github/pull_request_template.md`.
- Ensure CI checks pass.
- Use **Squash and merge** in GitHub.

## Merge Policy
- Prefer **Squash and merge**.
- Delete branch after merge.
- If your branch lags behind `main`, rebase before merge.
