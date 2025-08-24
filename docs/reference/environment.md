# Environment Variables Reference

This document provides a complete reference for all environment variables used in the OSWatcher Frontend application.

## Required Environment Variables

### `VITE_GRAPHEOS_API_URI`

**Type:** `string`  
**Required:** Yes  
**Description:** The base URL for the GraphQL API endpoint.

**Usage:**
- Used by Apollo Client to establish GraphQL connection
- Used by PostHog for event tracking (API domain extraction)
- Automatically appends `/graphql` path for GraphQL endpoint

**Example Values:**
```bash
# Development
VITE_GRAPHEOS_API_URI=http://localhost:4000

# Production
VITE_GRAPHEOS_API_URI=https://api.oswatcher.com
```

**Validation:**
The application will throw an error on startup if this variable is not defined:
```typescript
const apiUri = import.meta.env.VITE_GRAPHEOS_API_URI
if (!apiUri) {
  throw new Error('VITE_GRAPHEOS_API_URI environment variable is required')
}
```

**File Location:** `src/graphql-client.ts:6-8`

### `VITE_GRAPHEORS_OBJECT_STORAGE_URI`

**Type:** `string`  
**Required:** Yes  
**Description:** The base URL for object storage service used for file downloads.

**Usage:**
- Used by download utilities to fetch files by hash
- Provides access to binary data stored outside the GraphQL API

**Example Values:**
```bash
# Development
VITE_GRAPHEORS_OBJECT_STORAGE_URI=http://localhost:9000

# Production  
VITE_GRAPHEORS_OBJECT_STORAGE_URI=https://storage.oswatcher.com
```

**File Location:** `src/download.ts`

## Optional Environment Variables

### PostHog Configuration

PostHog analytics is automatically configured based on production builds and uses the GraphQL API domain for event tracking. No additional environment variables are required for PostHog.

**File Location:** `src/plugins/posthog.ts`

## Environment File Setup

### Development Environment

Create a `.env` file in the project root:

```bash
# GraphQL API endpoint
VITE_GRAPHEOS_API_URI=http://localhost:4000

# Object storage endpoint
VITE_GRAPHEORS_OBJECT_STORAGE_URI=http://localhost:9000
```

### Production Environment

Environment variables should be set through your deployment platform:

```bash
# GraphQL API endpoint
VITE_GRAPHEOS_API_URI=https://api.oswatcher.com

# Object storage endpoint
VITE_GRAPHEORS_OBJECT_STORAGE_URI=https://storage.oswatcher.com
```

## Variable Naming Convention

All frontend environment variables follow the Vite convention and must be prefixed with `VITE_` to be accessible in the browser environment.

**Pattern:** `VITE_[SERVICE]_[PURPOSE]_URI`

- `VITE_` - Vite prefix for browser access
- `[SERVICE]` - Service identifier (e.g., GRAPHEOS, GRAPHEORS)
- `[PURPOSE]` - Purpose identifier (e.g., API, OBJECT_STORAGE)
- `URI` - Indicates URL/endpoint type

## Development vs Production

### Development Configuration
- Local services typically run on localhost with different ports
- HTTP protocol is acceptable for development
- Services may use default/weak authentication

### Production Configuration  
- HTTPS is required for all external communications
- Proper domain names with SSL certificates
- Secure authentication and API keys

## Backend Environment Variables

The `.env.example` file contains additional backend service configuration variables that are not used by the frontend application directly:

```bash
# Backend services (not used by frontend)
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

These variables are included for local development setup of the complete system but are not consumed by the frontend Vue application.

## Build-time Configuration

### Vite Configuration

The `vite.config.ts` sets different base paths for development vs production:

```typescript
base: process.env.NODE_ENV === 'production' ? '/frontend/' : '/'
```

### TypeScript Environment Types

Environment variable types are defined in `env.d.ts`:

```typescript
interface ImportMetaEnv {
  readonly VITE_GRAPHEOS_API_URI: string
  readonly VITE_GRAPHEORS_OBJECT_STORAGE_URI: string
}
```

## Troubleshooting

### Common Issues

1. **Missing Environment Variable Error**
   ```
   Error: VITE_GRAPHEOS_API_URI environment variable is required
   ```
   **Solution:** Ensure the variable is defined and properly prefixed with `VITE_`

2. **GraphQL Connection Failed**
   - Check if the API URI is correct and accessible
   - Verify CORS settings on the GraphQL server
   - Ensure the `/graphql` endpoint exists

3. **File Download Failures**
   - Verify `VITE_GRAPHEORS_OBJECT_STORAGE_URI` is correctly configured
   - Check object storage service availability
   - Ensure proper authentication/access permissions

### Debugging

Enable browser developer tools to inspect:
- Network requests to verify correct endpoint URLs
- Console errors for environment variable issues
- Apollo Client DevTools for GraphQL debugging