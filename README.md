# Campfire Hong Kong

A standalone website for Campfire Hong Kong - a high school game jam event.

## Tech Stack

- **Astro** - Static site framework
- **React 19** - UI components  
- **TypeScript** - Type safety
- **TailwindCSS 4** - Styling

## Project Structure

```
/astro
├── src/
│   ├── pages/
│   │   └── index.astro         # Main Hong Kong landing page
│   ├── components/
│   │   ├── pages/
│   │   │   └── Satellite.tsx   # Main Hong Kong site component
│   │   └── primitives/         # Reusable UI components
│   ├── config/
│   │   └── hongkong.ts         # Event configuration
│   └── styles/
│       └── global.css
└── public/                      # Static assets
```

## Development

```bash
cd astro
npm install
npm run dev
```

Visit `http://localhost:4321`

## Configuration

Edit `/astro/src/config/hongkong.ts` to customize:
- Event details (city, date, venue)
- Schedule
- Sponsors
- FAQ content
- Localization strings

## Build

```bash
cd astro
npm run build
```

Output in `/astro/dist`

## Deployment

The site is a static build with no backend dependencies. Deploy to any static hosting platform (Vercel, Netlify, Cloudflare Pages, etc.)
