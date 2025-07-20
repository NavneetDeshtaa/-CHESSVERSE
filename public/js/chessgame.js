const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");
const Message = document.getElementById("role");
let playerRole = null;
let selectedSquareCoords = null;
let legalMoves = [];

const getPieceUnicode = (type, color) => {
  const unicodePieces = {
    w: { p: "♙", r: "♖", n: "♘", b: "♗", q: "♕", k: "♔" },
    b: { p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚" },
  };
  return unicodePieces[color][type];
};

const getAlgebraic = (row, col) => `${String.fromCharCode(97 + col)}${8 - row}`;

// **REMOVED ALL LOCAL MESSAGE UPDATES FROM updateStatus**
function updateStatus() {
  // We'll just use this for gameOver check to display modal
  const gameStatus = chess.getStatus();
  if (gameStatus.gameOver) {
    // Client shows modal on gameOver event, so no need to update Message here
  }
}

const renderBoard = () => {
  boardElement.innerHTML = "";
  const boardArray = [];
  for (let i = 0; i < 8; i++) {
    boardArray[i] = [];
    for (let j = 0; j < 8; j++) {
      boardArray[i][j] = chess.get(getAlgebraic(i, j));
    }
  }

  legalMoves = selectedSquareCoords
    ? chess.moves({ square: getAlgebraic(selectedSquareCoords.row, selectedSquareCoords.col), verbose: true }).map(m => m.to)
    : [];

  boardArray.forEach((row, rowIndex) => {
    row.forEach((square, colIndex) => {
      const sq = document.createElement("div");
      sq.className = `square ${(rowIndex + colIndex) % 2 === 0 ? "light" : "dark"}`;
      sq.dataset.row = rowIndex;
      sq.dataset.col = colIndex;
      if (selectedSquareCoords?.row === rowIndex && selectedSquareCoords?.col === colIndex) {
        sq.classList.add("selected");
      }
      if (legalMoves.includes(getAlgebraic(rowIndex, colIndex))) {
        sq.classList.add("legal-move");
      }
      if (square) {
        const piece = document.createElement("div");
        piece.className = `piece ${square.color === "w" ? "white" : "black"}`;
        piece.textContent = getPieceUnicode(square.type, square.color);
        sq.appendChild(piece);
      }
      sq.addEventListener("click", () => handleSquareClick(square, rowIndex, colIndex));
      boardElement.appendChild(sq);
    });
  });

  boardElement.classList.toggle("flipped", playerRole === "b");
  document.getElementById("resetButton").style.display =
    playerRole === "spectator" ? "none" : "block";

  updateStatus();
  // Removed checkGameOver from renderBoard to avoid local modal triggering
  // Client only shows modal when receiving gameOver event from server
};

const checkGameOver = () => {
  // This function is now unused since server sends gameOver event
};

const displayGameOverModal = (message) => {
  let modal = document.getElementById("gameOverModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "gameOverModal";
    modal.className = "modal";
    const modalContent = document.createElement("div");
    modalContent.className = "modal-content";
    const messageElem = document.createElement("p");
    messageElem.textContent = message;
    modalContent.appendChild(messageElem);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
  } else {
    modal.querySelector("p").textContent = message;
  }
  modal.style.display = "flex";
};

const handleSquareClick = (square, row, col) => {
  // Enforce turn using playerRole and chess.turn()
  if (playerRole !== chess.turn()) {
    // Instead of local message, rely on server for "Not your turn" message
    return;
  }

  if (!selectedSquareCoords) {
    if (square && playerRole && square.color === playerRole) {
      selectedSquareCoords = { row, col };
      renderBoard();
    }
  } else {
    const target = getAlgebraic(row, col);
    if (legalMoves.includes(target)) {
      socket.emit("move", {
        from: getAlgebraic(selectedSquareCoords.row, selectedSquareCoords.col),
        to: target,
      });
    }
    selectedSquareCoords = null;
    renderBoard();
  }
};

// Socket events

socket.on("playerRole", (data) => {
  playerRole = data.role;
  Message.textContent = data.message; // Initial role message
  renderBoard();
});

socket.on("boardState", (fen) => {
  chess.load(fen);
  renderBoard();
});

socket.on("gameMessage", (message) => {
  // **ONLY place where Message.textContent changes for status**
  Message.innerText = message;
});

socket.on("gameReset", (message) => {
  chess.reset();
  selectedSquareCoords = null;
  Message.innerText = message;
  const modal = document.getElementById("gameOverModal");
  if (modal) modal.remove();
  renderBoard();
});

socket.on("gameOver", (message) => {
  displayGameOverModal(message);
});

socket.on("resetRequest", () => {
  if (playerRole !== "spectator") {
    const confirmDiv = document.createElement("div");
    confirmDiv.classList.add("confirmation-container");
    confirmDiv.innerHTML = `
      <p>Reset request received. Accept?</p>
      <button id="acceptReset">Yes</button>
      <button id="rejectReset">No</button>
    `;
    document.body.appendChild(confirmDiv);
    document.getElementById("acceptReset").addEventListener("click", () => {
      socket.emit("resetGameResponse", "accept");
      confirmDiv.remove();
    });
    document.getElementById("rejectReset").addEventListener("click", () => {
      confirmDiv.remove();
      Message.innerText = "Reset request declined";
    });
  }
});

document.getElementById("resetButton").addEventListener("click", () => {
  socket.emit("resetGameRequest");
  Message.innerText = "Waiting for opponent to accept reset...";
});

// Initial render
renderBoard();
