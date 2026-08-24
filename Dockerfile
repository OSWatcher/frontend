# Base image with a specific node version, using an alpine variant for smaller size
FROM node:21-alpine as build-stage
ARG NODE_ENV=development
# Defaults are sentinels, not real values. Vite resolves import.meta.env.* at
# build time, so an image built without these args bakes the placeholders and
# docker-entrypoint.sh substitutes the real configuration at container start.
# Passing the args explicitly still bakes real values, which keeps local and
# development builds working exactly as before.
ARG VITE_OSWATCHER_API_URI=__OSW_API_URI__

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to utilize Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install --include=dev

# Copy TypeScript, Vue, ESLint, and other configuration files
COPY tsconfig.json tsconfig.node.json tsconfig.app.json .eslintrc.cjs vue.config.js vite.config.ts ./

# Copy the rest of the source code
COPY src/ src/
COPY index.html .

# allow legacy crypto
ENV NODE_OPTIONS=--openssl-legacy-provider
# Build the application for production with minification
RUN npm run build-only

# Production stage: Use a smaller node image to run the built application
FROM node:21-alpine as production-stage

# Set the working directory in the new stage
WORKDIR /app

# Copy the built application from the build stage
COPY --from=build-stage /app/dist/ dist/

# Install a simple HTTP server for serving static content
RUN npm install -g serve

# Expose the port the app runs on
EXPOSE 8080

# Substitutes runtime configuration into the bundle before serving
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Run the application with a non-root user for security.
# dist/ must be writable so the entrypoint can substitute configuration.
RUN adduser -D appuser && chown -R appuser:appuser /app/dist
USER appuser

ENTRYPOINT ["docker-entrypoint.sh"]

# Serve the application using http-server
CMD ["serve", "-s", "dist", "-l", "8080"]
