FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# URL must be reachable from the user's browser (not from inside this container).
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build
RUN if [ -f /app/dist/trading-sim/app.js ]; then \
      sed -i "s|__TRADING_SIM_API_URL__|${VITE_API_URL}|g" /app/dist/trading-sim/app.js; \
    fi

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
