FROM node:20-alpine3.19

WORKDIR /srv

COPY package.json package-lock.json /srv/
RUN npm ci

COPY ./src/ /srv/src/

USER 1000:1000
CMD [ "/usr/local/bin/node", "/srv/src/index.js"]
