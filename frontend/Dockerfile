FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .


ENV VITE_API_BASE_URL=https://empwr-backend-746326922966.europe-west1.run.app/api
ENV VITE_GOOGLE_CLIENT_ID=746326922966-ln802nnkuh5tso2v7a1j13bd0j3h1ur2.apps.googleusercontent.com    
RUN npx vite build

# Serve with Nginx
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config to handle React Router (SPA)
RUN echo 'server { \
    listen 8080; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]