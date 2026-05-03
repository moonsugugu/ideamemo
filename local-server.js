const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = 4173;
const host = "127.0.0.1";
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

http
  .createServer((req, res) => {
    const pathname = decodeURIComponent(req.url.split("?")[0]);
    const safePath = path
      .normalize(pathname === "/" ? "index.html" : pathname)
      .replace(/^([/\\])+/, "")
      .replace(/^(\.\.[/\\])+/, "");
    const file = path.join(root, safePath);

    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(file, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
      });
      res.end(data);
    });
  })
  .listen(port, host, () => {
    console.log(`Memo Map running at http://localhost:${port}/`);
  });
