# Ferieplan

A client-side Danish vacation day planner built with React. No backend required — all state is stored in your browser's localStorage.

## What it does

Ferieplan helps you plan your vacation days under the Danish vacation system ("ferieloven"):

- **Earn 2.08 days per month** from your configured start date
- **5 extra days** ("6. ferieuge") granted in a configurable month
- **Danish public holidays** are automatically marked as free (no vacation days consumed)
- **Visual calendar** shows your planned days color-coded by balance status (green = covered, yellow = deficit)
- **Persistent state** — your selections survive page refreshes

## Getting started

```sh
npm install
npm run dev
```

## Tech stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui
- date-fns with Danish locale

## Available scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build (type-check + bundle) |
| `npx tsc --noEmit` | Type-check only |
