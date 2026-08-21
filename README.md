# OSWatcher Frontend

Vue.js application for exploring operating system analysis data with commit history, filesystem inspection, and optional authentication.

## Quick Start

This frontend is not meant to run standalone against a self-hosted backend: it expects an `oswatcher-deploy` stack (Docker Compose orchestration for the GraphQL API, Neo4j, and MinIO) running alongside it. Clone `oswatcher-deploy` as a sibling directory and follow its setup first.

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env to point at your oswatcher-deploy stack
# (conventionally a symlink to ../oswatcher-deploy/.env)

# Start development server
npm run dev
```

## Development Commands

```bash
npm run dev         # Start development server with hot reload
npm run build       # Build for production
npm run preview     # Preview production build
npm run lint        # Run ESLint with auto-fix
npm run type-check  # Run TypeScript checks
npm run format      # Format code with Prettier
npm run generate    # Generate GraphQL types from schema
```

## Documentation

```bash
npm run docs:dev    # Start documentation server
npm run docs:build  # Build documentation
```

## Configuration

### Required Environment Variables

- `VITE_OSWATCHER_API_URI` - GraphQL API endpoint (also used for blob downloads via `/blob/:hash`)

### Optional: Auth0 Authentication

- `VITE_AUTH0_DOMAIN` - Your Auth0 tenant domain
- `VITE_AUTH0_CLIENT_ID` - Auth0 application client ID
- `VITE_AUTH0_AUDIENCE` - Auth0 API identifier

See `.env.example` for configuration details.

## Tech Stack

- Vue 3 + TypeScript + Composition API
- Naive UI component library
- Apollo Client (GraphQL)
- Auth0 (optional authentication)
- Vite build tool
- D3.js for visualizations

## License

See LICENSE file for details.
