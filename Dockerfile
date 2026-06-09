# ---- Stage 1: build the frontend ----
    FROM node:20-alpine AS frontend-builder
    WORKDIR /app/frontend
    
    # Install frontend deps
    COPY frontend/package*.json ./
    RUN npm install
    
    # Build the frontend (relative /api base — same origin now, so DO NOT set VITE_API_BASE_URL)
    COPY frontend/ ./
    ENV VITE_GOOGLE_CLIENT_ID=746326922966-ln802nnkuh5tso2v7a1j13bd0j3h1ur2.apps.googleusercontent.com
    RUN npx vite build
    
    # ---- Stage 2: backend + serve built frontend ----
    FROM node:20-alpine
    WORKDIR /app
    
    # Install backend deps (includes tsx + typescript devDeps)
    COPY backend/package*.json ./
    RUN npm install
    
    # Backend source
    COPY backend/ ./
    
    # Copy the built frontend into the folder server.ts serves from
    COPY --from=frontend-builder /app/frontend/dist ./frontend-dist
    
    EXPOSE 3000
    CMD ["npx", "tsx", "src/server.ts"]