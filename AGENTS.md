# Campfire Hong Kong - Game Jam Website

## Commands
- **Development**: `npm run dev` (start development server from `/astro`)
- **Build**: `npm run build` (Astro build)  
- **Preview**: `npm run preview` (preview production build)
- **Working directory**: Always use `/Users/anscg/campfire-hk/astro` as cwd for npm commands

## Architecture
- **Tech Stack**: Astro + React 19 + TypeScript + TailwindCSS 4
- **Single Standalone Application**: Hardcoded Hong Kong event site at root
- **No Backend**: Purely static site with no database dependencies
- **Structure**: `/astro` contains entire application

## Code Style Guidelines
- **TypeScript**: Strict mode enabled, prefer explicit types, use `.tsx` for React components
- **React**: Functional components with hooks, React 19 features
- **Props**: Use interface definitions with optional props (e.g., `{ className?: string }`)
- **Styling**: TailwindCSS classes, inline styles for custom fonts
- **Assets**: Public assets in `/astro/public`, imported with `/path` prefix
- **Functions**: Use `function ComponentName()` declaration style for components
- **Imports**: ES modules, prefer named imports, use `.tsx` extensions
- **Naming**: PascalCase for components, camelCase for variables/functions
- **No Tests**: No testing framework - purely presentation website

## Event Configuration
- Event data lives in `/astro/src/config/hongkong.ts`
- To customize: edit this file (schedule, sponsors, venue, etc.)
- No external data sources (Airtable/database) needed
