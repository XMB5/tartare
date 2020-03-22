FROM node:13

ENV TARTARE_PORT=3000
ENV TARTARE_HOST=0.0.0.0
ENV TARTARE_VIDEOS=/videos
ENV TARTARE_CACHE=/cache
EXPOSE 3000

RUN ["mkdir", "/app"]
COPY package.json /app/
WORKDIR /app/
RUN ["npm", "i"]

COPY . /app/
ENTRYPOINT ["node", "tartare.js"]