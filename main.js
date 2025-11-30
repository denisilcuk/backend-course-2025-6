const { program } = require("commander");
const http = require("http");
const fs = require("fs");
const path = require("path");

program
  .requiredOption("-h, --host <string>", "Адреса сервера (обовʼязково)")
  .requiredOption("-p, --port <number>", "Порт сервера (обовʼязково)")
  .requiredOption(
    "-c, --cache <path>",
    "Шлях до директорії для кешування (обовʼязково)"
  );

program.parse(process.argv);
const options = program.opts();

const cacheDir = path.resolve(options.cache);

if (!fs.existsSync(cacheDir)) {
  console.log(`Директорія кешу не існує. Створюю: ${cacheDir}`);
  fs.mkdirSync(cacheDir, { recursive: true });
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Server is running!\n");
});

server.listen(options.port, options.host, () => {
  console.log(`Сервер запущено: http://${options.host}:${options.port}`);
  console.log(`Кеш директорія: ${cacheDir}`);
});
