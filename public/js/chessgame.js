const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");
const roleElement = document.getElementById("role");
let playerRole = null;
let resetRequestPending = false;
let resetMessageDisplayed = false;
let draggedPiece = null;
let sourceSquare = null;

const getPieceUnicode = (type, color) => {
  const unicodePieces = {
    w: { p: "♙", r: "♖", n: "♘", b: "♗", q: "♕", k: "♔" },
    b: { p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚" },
  };
  return unicodePieces[color][type];
};

const renderBoard = () => {
  const board = chess.board();
  boardElement.innerHTML = "";
  board.forEach((row, rowIndex) => {
    row.forEach((square, squareIndex) => {
      const squareElement = document.createElement("div");
      squareElement.classList.add(
        "square",
        (rowIndex + squareIndex) % 2 === 0 ? "light" : "dark"
      );

      if (square) {
        const pieceElement = document.createElement("div");
        pieceElement.classList.add(
          "piece",
          square.color === "w" ? "white" : "black"
        );
        pieceElement.innerText = getPieceUnicode(square.type, square.color);
        pieceElement.draggable = true;

        pieceElement.addEventListener("dragstart", (e) => {
          if (
            playerRole &&
            ((playerRole === "w" && square.color === "w") ||
              (playerRole === "b" && square.color === "b"))
          ) {
            draggedPiece = pieceElement;
            sourceSquare = { row: rowIndex, col: squareIndex };
            e.dataTransfer.setData("text/plain", "");
          }
        });

        squareElement.appendChild(pieceElement);
      }

      squareElement.addEventListener("dragover", (e) => e.preventDefault());
      squareElement.addEventListener("drop", () => {
        if (draggedPiece && playerRole) {
          handleMove(sourceSquare, { row: rowIndex, col: squareIndex });
        }
      });

      boardElement.appendChild(squareElement);
    });
  });

  if (playerRole === "b") {
    boardElement.classList.add("flipped");
  } else {
    boardElement.classList.remove("flipped");
  }

  if (playerRole === "spectator") {
    document.getElementById("resetButton").style.display = "none";
  } else {
    document.getElementById("resetButton").style.display = "block";
  }
};

socket.on("playerRole", function (data) {
  playerRole = data.role;

  if (playerRole === "w") {
    roleElement.innerText = "Waiting for another player...";
  } else if (playerRole === "b") {
    roleElement.innerText = "Waiting for White player to make their move.";
    socket.emit("updatePlayerMessages", {
      whiteMessage: "Your turn.",
      blackMessage: "Waiting for White player to make their move.",
    });
  } else if (playerRole === "spectator") {
    roleElement.innerText = "You are a spectator. Watch the game unfold!";
  }
  renderBoard();
});

socket.on("updateMessages", (messages) => {
  roleElement.innerText = messages[playerRole] || "";
});

socket.on("boardState", function (fen) {
  chess.load(fen);
  renderBoard();

  const currentTurn = chess.turn();
  if (
    (playerRole === "w" && currentTurn === "w") ||
    (playerRole === "b" && currentTurn === "b")
  ) {
    roleElement.innerText = "Waiting for other player ....";
  } else if (playerRole === "spectator") {
    roleElement.innerText = "You are a spectator. Watch the game unfold!";
  } else {
    roleElement.innerText = "Waiting for the other player to make their move.";
  }
});

socket.on("gameReset", function (message) {
  chess.reset();
  roleElement.innerText = message;
  renderBoard();
  resetMessageDisplayed = true;
});

socket.on("gameMessage", function (message) {
  roleElement.innerText = message;
});

socket.on("resetRequest", (requestingPlayer) => {
  if (playerRole !== "spectator") {
    const confirmationDiv = document.createElement("div");
    confirmationDiv.classList.add("confirmation-container");
    confirmationDiv.innerHTML = `
      <p>The other player has requested to reset the game. Do you accept?</p>
      <button id="acceptReset">Yes</button>
      <button id="rejectReset">No</button>
    `;
    document.body.appendChild(confirmationDiv);

    document.getElementById("acceptReset").addEventListener("click", () => {
      socket.emit("resetGameResponse", "accept");
      document.body.removeChild(confirmationDiv);
    });

    document.getElementById("rejectReset").addEventListener("click", () => {
      socket.emit("resetGameResponse", "reject");
      document.body.removeChild(confirmationDiv);
      roleElement.innerText = "You rejected the reset request.";
    });
  }
});

const resetGame = () => {
  if (playerRole !== "spectator" && !resetRequestPending) {
    resetRequestPending = true;
    socket.emit("resetGameRequest");
    roleElement.innerText =
      "Waiting for the other player to accept the reset request...";
  }
};

document.getElementById("resetButton").addEventListener("click", resetGame);

const handleMove = (source, target) => {
  if (playerRole === "spectator") return;

  const sourceSquare = `${String.fromCharCode(
    97 + source.col
  )}${8 - source.row}`;
  const targetSquare = `${String.fromCharCode(
    97 + target.col
  )}${8 - target.row}`;

  socket.emit("move", { from: sourceSquare, to: targetSquare, promotion: "q" });

  if (resetMessageDisplayed) {
    resetMessageDisplayed = false;
    roleElement.innerText = "";
  }
};

renderBoard();
