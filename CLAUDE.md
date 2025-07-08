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

## Architecture Overview

### Technology Stack
- **Frontend**: Vue 3 with Composition API and TypeScript
- **UI Framework**: Bootstrap Vue Next with Bootstrap 5
- **GraphQL**: Apollo Client for API communication
- **Build Tool**: Vite with Vue plugin
- **Styling**: Bootstrap CSS with custom SCSS

### Project Structure
- `src/views/` - Main application views (HomeView, OSView, DiffView)
- `src/components/` - Reusable Vue components organized by feature
- `src/router/` - Vue Router configuration
- `src/queries.ts` - GraphQL queries and mutations
- `src/graphql-client.ts` - Apollo Client setup and configuration
- `src/graphql-types.ts` - Auto-generated TypeScript types from GraphQL schema

### Key Application Concepts

**OSWatcher Frontend** is a Vue.js application for exploring operating system analysis data. The application provides:

1. **Commit History View** (`HomeView`): Displays git-like commit history with branch support and diff comparison functionality
2. **OS Analysis View** (`OSView`): Multi-tab interface for exploring:
   - Filesystem trees
   - Windows Registry data
   - PDB symbol information
3. **Diff View** (`DiffView`): Compare two commits showing differences across filesystem, registry, and symbols

### GraphQL Integration
- Schema located at `schema.graphql` defines the data model
- Codegen configuration in `codegen.yml` auto-generates TypeScript types
- Client configured in `src/graphql-client.ts` with error handling and caching
- All queries centralized in `src/queries.ts`

### Component Architecture
- Tree-based components (`FilesystemTree`, `RegistryTree`, `PDBExplorer`) for hierarchical data
- Diff components (`FilesystemTreeDiff`, `RegistryTreeDiff`, etc.) for comparison views
- Reusable table components (`CommitsTable`) for data display

### Environment Configuration

#### Required Environment Variables
- `VITE_GRAPHEOS_API_URI` - GraphQL API endpoint URL (used for Apollo Client and PostHog events)
- `VITE_GRAPHEORS_OBJECT_STORAGE_URI` - Object storage URL for downloading files by hash

#### Development Setup
1. Copy `.env.example` to `.env` and configure required variables
2. The `.env` file contains backend service configuration (Neo4j, MinIO, etc.) for local development
3. Frontend-specific variables must be prefixed with `VITE_` to be accessible in the browser

#### Build Configuration
- Production base path set to `/frontend/` in Vite config
- PostHog analytics enabled only in production builds

### Development Notes
- Search functionality (Ctrl+K) is currently disabled in navigation
- The application expects a Neo4j-backed GraphQL API serving commit, filesystem, registry, and PDB data
- Bootstrap Vue Next provides consistent UI components with dark mode support
- Type safety enforced through TypeScript and auto-generated GraphQL types