# Використовуємо офіційний Node.js образ
FROM node:18

# Робоча директорія всередині контейнера
WORKDIR /app

# Копіюємо package.json та встановлюємо залежності
COPY package*.json ./
RUN npm install

# Копіюємо решту файлів у контейнер
COPY . .

# Параметри за замовчуванням
ENV HOST=0.0.0.0
ENV PORT=3000
ENV CACHE=/app/cache

# Відкриваємо порт 3000
EXPOSE 3000

# Створюємо папку кеша
RUN mkdir -p /app/cache

# Команда запуску
CMD ["node", "main.js", "--host", "0.0.0.0", "--port", "3000", "--cache", "/app/cache"]
