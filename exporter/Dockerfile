FROM mcr.microsoft.com/playwright:v1.51.0-jammy
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8787
CMD ["npm", "run", "dev"]
