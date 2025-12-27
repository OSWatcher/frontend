# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm install` - Install dependencies
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production (runs type-check and build-only in parallel)
- `npm run preview` - Preview production build locally

### Code Quality
- `npm run lint` - Run ESLint with auto-fix
- `npm run type-check` - Run TypeScript compiler checks
- `npm run format` - Format code with Prettier
- `npm run format-check` - Check code formatting

### GraphQL
- `npm run generate` - Generate TypeScript types from GraphQL schema using codegen

### Documentation
- `npm run docs:dev` - Start VitePress documentation server with hot reload
- `npm run docs:build` - Build static documentation site
- `npm run docs:preview` - Preview the built documentation

## Architecture Overview

### Technology Stack
- **Frontend**: Vue 3 with Composition API and TypeScript
- **UI Framework**: Naive UI component library
- **Authentication**: Auth0 (optional, configured via environment variables)
- **GraphQL**: Apollo Client for API communication
- **Build Tool**: Vite with Vue plugin
- **Styling**: CSS with scoped component styles

### Project Structure
- `src/views/` - Main application views (HomeView, InspectorView, CallbackView)
- `src/components/` - Reusable Vue components organized by feature
- `src/router/` - Vue Router configuration
- `src/queries.ts` - GraphQL queries and mutations
- `src/graphql-client.ts` - Apollo Client setup and configuration with Auth0 token injection
- `src/graphql-types.ts` - Auto-generated TypeScript types from GraphQL schema
- `docs/reference/` - Technical reference documentation (VitePress)

### Key Application Concepts

**OSWatcher Frontend** is a Vue.js application for exploring operating system analysis data. The application provides:

1. **Commit History View** (`HomeView`): Displays git-like commit history with branch support and diff comparison functionality using D3.js visualization
2. **Inspector View** (`InspectorView`): Unified interface for exploring commits with two modes:
   - **Single Mode**: View a single commit's data (filesystem, registry, symbols)
   - **Comparison Mode**: Compare two commits showing differences
   - Supports both unified and side-by-side layouts
3. **Authentication** (`CallbackView`): Auth0 integration for user authentication (optional, not enforced by default)

### GraphQL Integration
- Schema located at `schema.graphql` defines the data model
- Codegen configuration in `codegen.yml` auto-generates TypeScript types
- Client configured in `src/graphql-client.ts` with error handling and caching
- All queries centralized in `src/queries.ts`

### Component Architecture
- **Inspector Components**: Unified architecture for both single and comparison modes
  - `FilesystemInspector` - Handles filesystem exploration with mode-aware columns and diff status filtering
  - `RegistryInspector` - Windows Registry data viewing with diff status filtering
  - `InspectorHeader` - Mode switching and layout controls
  - `DiffStatusFilter` - Reusable component for filtering diff entries by status (NEW/MOD/DEL) with 1-second debounce
- **Graph Visualization**: D3.js-based commit graph with interactive features
- **Authentication UI**: Login/logout components integrated in App header
- Naive UI components for consistent design (NDataTable, NButton, NModal, etc.)

### Environment Configuration

#### Required Environment Variables
- `VITE_GRAPHEOS_API_URI` - GraphQL API endpoint URL (used for Apollo Client, PostHog events, and blob downloads via REST API `/blob/:hash`)

#### Optional Environment Variables (Auth0)
- `VITE_AUTH0_DOMAIN` - Auth0 tenant domain (e.g., your-tenant.us.auth0.com)
- `VITE_AUTH0_CLIENT_ID` - Auth0 application client ID
- `VITE_AUTH0_AUDIENCE` - Auth0 API identifier for access tokens

Authentication is optional and not enforced by default. When configured, the application will:
- Display login/logout UI in the header
- Automatically include Bearer tokens in GraphQL requests
- Support social login (Google, GitHub) and email/password authentication
- Use localStorage with refresh tokens for persistent sessions

#### Development Setup
1. Copy `.env.example` to `.env` and configure required variables
2. The `.env` file contains backend service configuration (Neo4j, MinIO, etc.) for local development
3. Frontend-specific variables must be prefixed with `VITE_` to be accessible in the browser

#### Build Configuration
- Production base path set to `/frontend/` in Vite config
- PostHog analytics enabled only in production builds

### Documentation Structure
The project includes comprehensive technical reference documentation:
- `docs/reference/api.md` - Complete GraphQL API reference with all queries and types
- `docs/reference/environment.md` - Environment variables and configuration reference
- `docs/reference/types.md` - TypeScript types including custom and generated types
- `docs/reference/architecture.md` - System architecture and design patterns
- Documentation is built with VitePress and includes search, navigation, and live reload

### Development Notes
- **Search functionality**: Global filesystem search available via Ctrl+K (streams results from GraphQL)
- **Backend**: Expects Neo4j-backed GraphQL API serving commit, filesystem, registry, and PDB data
- **Authentication**: Auth0 integration is optional and can be enabled via environment variables
- **UI Library**: Naive UI provides consistent component design and theming
- **Type Safety**: Enforced through TypeScript and auto-generated GraphQL types
- **Token Management**: Apollo Client automatically injects Auth0 Bearer tokens when available
- **Routing**: Uses Vue Router with support for single and comparison inspector modes