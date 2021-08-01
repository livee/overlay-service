FROM node:15.14.0-alpine

RUN echo @edge http://nl.alpinelinux.org/alpine/edge/community >> /etc/apk/repositories && \
    echo @edge http://nl.alpinelinux.org/alpine/edge/main >> /etc/apk/repositories && \
    apk update && \
    apk add --no-cache ffmpeg bash chromium nss@edge

ARG LOGGER_PATH

ENV CHROME_BIN=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN mkdir -p $LOGGER_PATH
RUN chmod -R 777 $LOGGER_PATH

RUN adduser -D -g '' appuser

WORKDIR /app

COPY . .

RUN yarn

USER appuser

WORKDIR /app

ENV NODE_PATH .
ENV NODE_ENV production

ENTRYPOINT ["node", "build/src/run"]
