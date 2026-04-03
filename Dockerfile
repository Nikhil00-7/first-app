FROM node:20-alpine  AS builder 

WORKDIR /app 

COPY package*.json ./ 

RUN npm install 

COPY . .

FROM  node:20-alpine 

RUN apk add --no-cache curl 

RUN addgroup -S appgroup && adduser -S appuser  -G appgroup 

WORKDIR /app 

COPY --from=builder /app . 

RUN  chown -R appuser:appgroup /app 

USER appuser  

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD  curl -f "http://localhost:3000/health" || exit 1 

EXPOSE 3000 

CMD ["npm" , "start"]