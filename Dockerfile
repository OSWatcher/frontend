# Base image with a specific node version, using an alpine variant for smaller size
FROM node:21-alpine as build-stage

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to utilize Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy TypeScript, Vue, ESLint, and other configuration files
COPY tsconfig.json .eslintrc.cjs vue.config.js ./

# Copy the rest of the source code
COPY src/ src/
COPY public/ public/

# allow legacy crypto
ENV NODE_OPTIONS=--openssl-legacy-provider
# Build the application for production with minification
RUN npm run build

# Production stage: Use a smaller node image to run the built application
FROM node:21-alpine as production-stage

# Set the working directory in the new stage
WORKDIR /app

# Copy the built application from the build stage
COPY --from=build-stage /app/dist/ dist/

# Install a simple HTTP server for serving static content
RUN npm install -g http-server

# Expose the port the app runs on
EXPOSE 8080

# Run the application with a non-root user for security
RUN adduser -D appuser
USER appuser


# Serve the application using http-server
CMD ["http-server", "dist", "-p", "8080"]