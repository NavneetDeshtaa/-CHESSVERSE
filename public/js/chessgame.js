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

function updateStatus() {
  const gameStatus = chess.getStatus();
  if (gameStatus.gameOver) {
    if (gameStatus.draw) Message.textContent = "Game over - Draw";
    else if (gameStatus.checkmate) Message.textContent = "Game over - Checkmate";
    return;
  }
  const turn = chess.turn();
  if (playerRole === turn) Message.textContent = "Your turn – Make your move!";
  else if (playerRole === "spectator") Message.textContent = "You are a spectator. Watch the game unfold.";
  else Message.textContent = "Waiting for opponent's move…";
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
  checkGameOver();
};

const checkGameOver = () => {
  const gameStatus = chess.getStatus();
  if (!gameStatus.gameOver) return;
  let message;
  if (gameStatus.checkmate) {
    const winner = chess.turn() === "w" ? "Black" : "White";
    message = `Checkmate! ${winner} wins!`;
  } else {
    if (gameStatus.stalemate) message = "Game ended in a stalemate!";
    else if (gameStatus.insufficientMaterial) message = "Draw due to insufficient material!";
    else if (gameStatus.threefoldRepetition) message = "Draw by threefold repetition!";
    else if (gameStatus.fiftyMoves) message = "Draw by the 50-move rule!";
    else message = "Game ended in a draw!";
  }
  displayGameOverModal(message);
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
  // **TURN ENFORCEMENT:** block if it's not your turn (including spectators)
  if (playerRole !== chess.turn()) {
    Message.textContent = "Not your turn. Wait for opponent.";
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
  Message.textContent = data.message;
  renderBoard();
});

socket.on("boardState", (fen) => {
  chess.load(fen);
  renderBoard();
});

socket.on("gameMessage", (message) => {
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
