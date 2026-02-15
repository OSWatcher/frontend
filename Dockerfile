# Base image with a specific node version, using an alpine variant for smaller size
FROM node:21-alpine as build-stage
ARG NODE_ENV=development
ARG VITE_GRAPHEOS_API_URI=http://localhost:4000/
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to utilize Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install

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

# Run the application with a non-root user for security
RUN adduser -D appuser
USER appuser


# Serve the application using http-server
CMD ["serve", "-s", "dist", "-l", "8080"]
