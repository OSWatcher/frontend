# OSWatcher Frontend Documentation

Welcome to the OSWatcher Frontend technical documentation. This documentation provides comprehensive reference materials for developers working with the OSWatcher Frontend Vue.js application.

## What is OSWatcher Frontend?

OSWatcher Frontend is a Vue.js application for exploring operating system analysis data. The application provides a web interface for browsing commit history, exploring filesystem structures, Windows Registry data, and PDB symbol information.

## Architecture Overview

- **Frontend**: Vue 3 with Composition API and TypeScript
- **UI Framework**: Naive UI component library
- **GraphQL**: Apollo Client for API communication
- **Build Tool**: Vite with Vue plugin
- **Styling**: CSS with scoped component styles

## Key Features

- **Commit History View**: Git-like commit timeline with branch support
- **OS Analysis View**: Multi-tab interface for exploring filesystem, registry, and PDB data
- **Diff View**: Side-by-side comparison of commits showing hierarchical differences
- **Monaco Struct Diff**: Side-by-side C struct visualization using Monaco Editor for comparing PDB struct definitions
- **Hash-Based Navigation**: Content-addressed data access for immutable exploration
- **Tree Virtualization**: Efficient rendering of large hierarchical datasets

## Reference Documentation

::: info Reference Materials
This documentation focuses on **reference materials** following the [Divio documentation framework](https://documentation.divio.com/). These are technical specifications intended for developers already familiar with Vue.js and GraphQL.
:::

### [API Reference](/reference/api)
Complete GraphQL API documentation including all queries, mutations, types, and Apollo Client configuration.

### [Environment Variables](/reference/environment)
Configuration reference for all environment variables, including required settings and deployment considerations.

### [Types Reference](/reference/types)
TypeScript type definitions including custom types, GraphQL-generated types, and utility types.

### [Architecture Reference](/reference/architecture)
Technical architecture documentation covering project structure, data flow patterns, and system design.

## Quick Start

To get started with development:

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Generate GraphQL types
npm run generate

# Run documentation locally
npm run docs:dev
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run test` | Run unit tests with Vitest |
| `npm run lint` | Run ESLint with auto-fix |
| `npm run type-check` | Run TypeScript checks |
| `npm run generate` | Generate GraphQL types |

## Need Help?

- Check the [API Reference](/reference/api) for GraphQL queries
- Review [Types Reference](/reference/types) for TypeScript definitions  
- Consult [Architecture Reference](/reference/architecture) for system design
- Verify [Environment Variables](/reference/environment) for configuration

---

*This documentation is generated for the OSWatcher Frontend Vue.js application.*