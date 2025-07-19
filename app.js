const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socket(server, {
  cors: {
    origin: "https://chess-game-1mz3.onrender.com",
    methods: ["GET", "POST"],
  },
});

let chess = new Chess();
let players = {};

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index", { title: "Chess Game" });
});

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // Player assignment logic
  if (!players.white) {
    players.white = socket.id;
    socket.emit("playerRole", {
      role: "w",
      message: "You are White. Waiting for other player…",
    });
    socket.emit("gameMessage", "Waiting for Black to join…");
  } else if (!players.black) {
    players.black = socket.id;
    socket.emit("playerRole", {
      role: "b",
      message: "You are Black. Waiting for White to move…",
    });
    io.to(players.white).emit(
      "gameMessage",
      "Black has joined. Your turn – Make your move!"
    );
  } else {
    socket.emit("playerRole", {
      role: "spectator",
      message: "You are a Spectator. Watch the game unfold.",
    });
  }

  // Send initial board state
  socket.emit("boardState", chess.fen());

  socket.on("move", (move) => {
    try {
      // enforce turn on server
      const isPlayerTurn =
        (socket.id === players.white && chess.turn() === "w") ||
        (socket.id === players.black && chess.turn() === "b");

      if (!isPlayerTurn) {
        socket.emit("gameMessage", "It is not your turn.");
        return;
      }

      const result = chess.move({
        from: move.from,
        to: move.to,
        promotion: "q",
      });

      if (result) {
        io.emit("boardState", chess.fen());

        // Notify next/other player
        const nextTurn = chess.turn();
        const nextPlayer = nextTurn === "w" ? players.white : players.black;
        const waitingPlayer = nextTurn === "w" ? players.black : players.white;

        if (nextPlayer) {
          io.to(nextPlayer).emit("gameMessage", "Your turn – Make your move!");
        }
        if (waitingPlayer) {
          io
            .to(waitingPlayer)
            .emit("gameMessage", "Waiting for opponent's move…");
        }

        // **Game‑over logic using built‑in methods**
        if (chess.game_over()) {
          if (chess.in_checkmate()) {
            // winner is the side that just moved
            const winner = chess.turn() === "w" ? "Black" : "White";
            io.emit("gameOver", `${winner} wins by checkmate!`);
          } else if (chess.in_draw()) {
            let reason = "Game ended in a draw!";
            if (chess.in_stalemate()) {
              reason = "Game ended in a stalemate!";
            } else if (chess.insufficient_material()) {
              reason = "Game ended in a draw due to insufficient material!";
            } else if (chess.in_threefold_repetition()) {
              reason = "Game ended in a draw by threefold repetition!";
            } else if (chess.half_moves >= 100) {
              reason = "Game ended in a draw by the 50-move rule!";
            }
            io.emit("gameOver", reason);
          }
        }
      } else {
        socket.emit("gameMessage", "Invalid move. Try again.");
      }
    } catch (err) {
      console.error("Move error:", err);
      socket.emit("gameMessage", "Invalid move.");
    }
  });

  socket.on("resetGameRequest", () => {
    const otherPlayer =
      socket.id === players.white ? players.black : players.white;
    if (otherPlayer) {
      io.to(otherPlayer).emit("resetRequest", socket.id);
    }
  });

  socket.on("resetGameResponse", (response) => {
    if (response === "accept") {
      chess = new Chess();
      players = {};
      io.emit("boardState", chess.fen());
      io.emit("gameReset", "The game has been reset.");
    }
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
    if (socket.id === players.white || socket.id === players.black) {
      chess = new Chess();
      players = {};
      io.emit("boardState", chess.fen());
      io.emit("gameMessage", "A player disconnected. Game reset.");
    }
  });
});


server.listen(process.env.PORT || 3000, () => {
  console.log("Server is running on port", process.env.PORT || 3000);
});
