const { program } = require("commander");
const http = require("http");
const fs = require("fs");
const path = require("path");

// ---------- 1. Налаштування аргументів командного рядка ----------
program
  .requiredOption("-h, --host <string>", "Адреса сервера (обовʼязково)")
  .requiredOption("-p, --port <number>", "Порт сервера (обовʼязково)")
  .requiredOption(
    "-c, --cache <path>",
    "Шлях до директорії для кешування (обовʼязково)"
  );

program.parse(process.argv);
const options = program.opts();

// ---------- 2. Створення директорії cache якщо її не існує ----------
const cacheDir = path.resolve(options.cache);

if (!fs.existsSync(cacheDir)) {
  console.log(`Директорія кешу не існує. Створюю: ${cacheDir}`);
  fs.mkdirSync(cacheDir, { recursive: true });
}

// ---------- 3. Запуск HTTP сервера ----------
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Server is running!\n");
});

server.listen(options.port, options.host, () => {
  console.log(`Сервер запущено: http://${options.host}:${options.port}`);
  console.log(`Кеш директорія: ${cacheDir}`);
});
