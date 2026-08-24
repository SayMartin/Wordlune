# Static SPA build (app.config.js sets web.output: 'single') — no server-side
# runtime needed at all, so the final image is just nginx serving dist/.
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# EXPO_PUBLIC_* vars are inlined into the JS bundle at build time by Metro,
# not read at container runtime — must be passed as build args (see the
# GitHub Actions workflow), not via docker-compose env_file.
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY
ENV EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL
ENV EXPO_PUBLIC_SUPABASE_ANON_KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build:web

# nginx.conf serves this as the body for unknown paths (error_page 404). It is
# byte-identical to index.html — same bundle, same SPA shell — so the app boots
# and React Navigation renders NotFoundScreen, while the response carries a real
# 404 instead of the soft 404 a blanket SPA fallback would produce.
RUN cp dist/index.html dist/404.html

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Included from every location block in default.conf — see the comment there
# about add_header not being inherited into locations that set their own.
COPY security-headers.conf /etc/nginx/security-headers.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
