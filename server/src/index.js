const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

// Create an Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Simple in-memory "world" state
// - keys are socket IDs or player IDs
// - values store { x, y, z, rotation, ... } etc.
const players = {};

// Serve a basic "index" message for testing
app.get("/", (req, res) => {
  res.send("Minecraft.js Multiplayer Server is running!");
});

// Handle new client connections
io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Initialize this player's state
  players[socket.id] = {
    x: 0,
    y: 30,
    z: 0,
    rotation: 0,
  };

  socket.emit("worldState", {
    players,
  });
  
  // Tell everyone else a new player joined
  socket.broadcast.emit("playerJoined", {
    id: socket.id,
    state: players[socket.id],
  });

  // When this player moves, update state + broadcast
  socket.on("movePlayer", (newState) => {
    if (players[socket.id]) {
      players[socket.id] = {
        ...players[socket.id],
        ...newState,
      };
      // Broadcast to all clients (including self if desired)
      io.emit("playerMoved", {
        id: socket.id,
        state: players[socket.id],
      });
    }
  });

  // Handle block placement/removal
  socket.on("blockUpdate", (blockData) => {
    // e.g., { x, y, z, blockId, type: 'place' or 'remove' }
    // Perform your world/chunk update here, then broadcast
    io.emit("blockUpdated", blockData);
  });

  // On disconnect, remove player + notify others
  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete players[socket.id];
    socket.broadcast.emit("playerLeft", { id: socket.id });
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
