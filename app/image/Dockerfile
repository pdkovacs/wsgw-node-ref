FROM node:lts-slim

LABEL Name="wsgw-e2e-test-app-node"
LABEL Version="1.0.0"

RUN useradd -u 1101 -m --shell /bin/false wsg-e2e-app

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends iproute2 netcat-traditional dnsutils curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --chown=root:root --chmod=555 version.json bundle.js ./

EXPOSE 8080

USER wsg-e2e-app

LABEL service.type="application"
CMD [ "node", "bundle.js" ]
