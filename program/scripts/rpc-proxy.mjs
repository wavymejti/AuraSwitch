// Single-port front for Surfpool: HTTP -> RPC (18899), WebSocket upgrade -> WS (18900).
import http from "node:http";
import net from "node:net";

const server = http.createServer((req, res) => {
  const up = http.request(
    { host: "127.0.0.1", port: 18899, path: req.url, method: req.method, headers: req.headers },
    (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); },
  );
  up.on("error", () => { res.writeHead(502); res.end(); });
  req.pipe(up);
});

server.on("upgrade", (req, socket, head) => {
  const up = net.connect(18900, "127.0.0.1", () => {
    const headers = Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join("\r\n");
    up.write(`${req.method} ${req.url} HTTP/1.1\r\n${headers}\r\n\r\n`);
    up.write(head);
    socket.pipe(up).pipe(socket);
  });
  up.on("error", () => socket.destroy());
  socket.on("error", () => up.destroy());
});

server.listen(8899, "0.0.0.0", () => console.log("proxy on :8899"));
