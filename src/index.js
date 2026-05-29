import net from "net";
import Modbus from "jsmodbus";
import express from "express";
import dotenv from "dotenv/config";

const app = express();
app.use(express.json());

const connections = new Map();

app.post("/connect", (req, res) => {
  const { id, ip, port } = req.body;

  if (!id || !ip || !port) {
    return res.status(400).json({ error: "Missing id/ip/port" });
  }

  const key = String(id);

  if (connections.has(key)) {
    return res.status(400).json({ error: "ID already connected" });
  }

  const socket = new net.Socket();
  const client = new Modbus.client.TCP(socket);

  socket.setTimeout(5000);

  socket.on("timeout", () => {
    if (!res.headersSent) {
      res.status(408).json({ error: "Connection timed out" });
    }
    socket.destroy();
  });

  socket.on("connect", () => {
    socket.setTimeout(0); 
    socket.setKeepAlive(true, 5000);

    connections.set(key, {
      socket,
      client,
      ip,
      port,
      createdAt: new Date(),
    });

    console.log("Connected:", id);
    if (!res.headersSent) {
      res.json({ message: `Connected to ${ip}:${port}` });
    }
  });

  socket.on("error", (err) => {
    console.error("Socket error:", err.message);
    connections.delete(key);

    if (!res.headersSent) {
      res.status(500).send('connection error');
    }
  });

  socket.on("close", () => {
    console.log(`Connection ${id} closed`);
    connections.delete(key);
  });

  socket.connect({ host: ip, port: Number(port) });
});

app.get("/connections", (req, res) => {
  const list = Array.from(connections.entries()).map(([id, conn]) => ({
    id,
    ip: conn.ip,
    port: conn.port,
    createdAt: conn.createdAt,
  }));

  res.json(list);
});

app.post("/disconnect/:id", (req, res) => {
  const key = String(req.params.id);
  const connection = connections.get(key);

  if (!connection) {
    return res.status(404).json({ error: "PLC not found" });
  }

  try {
    connection.socket.destroy();
  } catch (e) {
    console.error(e);
  }

  connections.delete(key);
  res.json({ message: "Disconnected" });
});

app.listen(process.env.PORT, () => {
  console.log("Server running on port", process.env.PORT);
});
