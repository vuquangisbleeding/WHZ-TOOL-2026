const http = require('node:http');
const net = require('node:net');

function startAuthProxy({ host, port, username, password }) {
  const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  const sockets = new Set();
  const server = http.createServer((request, response) => {
    const upstream = http.request({
      host,
      port,
      method: request.method,
      path: request.url,
      headers: { ...request.headers, 'proxy-authorization': authorization }
    }, upstreamResponse => {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    });
    upstream.on('error', () => {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    });
    request.pipe(upstream);
  });

  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  server.on('connect', (request, clientSocket, head) => {
    const upstreamSocket = net.connect(port, host);
    sockets.add(upstreamSocket);
    upstreamSocket.on('close', () => sockets.delete(upstreamSocket));
    let pending = Buffer.alloc(0);
    const fail = () => {
      clientSocket.destroy();
      upstreamSocket.destroy();
    };
    upstreamSocket.setTimeout(8000, fail);
    clientSocket.setTimeout(8000, fail);
    const onData = chunk => {
      pending = Buffer.concat([pending, chunk]);
      const headerEnd = pending.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      upstreamSocket.off('data', onData);
      const status = Number(pending.subarray(0, headerEnd).toString('latin1').split(' ')[1]);
      if (status !== 200) return fail();
      upstreamSocket.setTimeout(0);
      clientSocket.setTimeout(0);
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      const rest = pending.subarray(headerEnd + 4);
      if (rest.length) clientSocket.write(rest);
      if (head?.length) upstreamSocket.write(head);
      upstreamSocket.pipe(clientSocket);
      clientSocket.pipe(upstreamSocket);
    };
    upstreamSocket.on('data', onData);
    upstreamSocket.on('error', fail);
    clientSocket.on('error', fail);
    upstreamSocket.on('connect', () => {
      upstreamSocket.write(`CONNECT ${request.url} HTTP/1.1\r\nHost: ${request.url}\r\nProxy-Authorization: ${authorization}\r\n\r\n`);
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        port: address.port,
        close() {
          server.close();
          for (const socket of sockets) socket.destroy();
        }
      });
    });
  });
}

module.exports = { startAuthProxy };
