import net from "net";
import Modbus from "jsmodbus";
import express from "express";
import dotenv from "dotenv/config"

const app = express();
app.use(express.json());

const connections = new Map();

app.post("/connect", (req, res) => {
  const { id, ip, port } = req.body;

  if (!id || !ip || !port) {
    return res.status(400).send("Missing id/ip/port");
  }

  if (connections.has(toString(id))) {
    return res.status(400).send("ID already connected");
  }

  const socket = new net.Socket();
  const client = new Modbus.client.TCP(socket);

  socket.connect({ host: ip, port:port });

  socket.on("connect", () => {
    socket.setKeepAlive(true, 5000);

    connections.set(toString(id), {
      socket,
      client,
      ip,
      port,
      createdAt: new Date(),
    });

    console.log("Connected:", id);

    res.send(`connected to ${ip}:${port}`);
  });

  socket.on("error", (err) => {
    console.error(err);

    connections.delete(id);

    if (!res.headersSent) {
      res.status(500).send(err.message);
    }
  });

  socket.on("close", () => {
    console.log(`connection ${id} closed`);
    connections.delete(id);
  });
});

/* LIST ALL CONNECTIONS */
app.get("/connections", (req, res) => {
  const list = Array.from(connections.entries()).map(([id, conn]) => ({
    id,
    ip: conn.ip,
    port: conn.port,
    createdAt: conn.createdAt,
  }));

  res.json(list);
});

/* DISCONNECT */
app.post("/disconnect/:id", (req, res) => {
  const connection = connections.get(toString(req.params.id));
  if (!connection) {
    return res.status(404).send("PLC not found");
  }

  try {
    connection.socket.end();
    connection.socket.destroy();
  } catch (e) {
    console.error(e);
  }

  connections.delete(req.params.id);

  res.send("Disconnected");
});


app.listen(process.env.PORT, () => {
  console.log("Server running on port ", process.env.PORT);
});
