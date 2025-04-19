const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");
const statusEl = document.getElementById("role");
let playerRole = null;
let selectedSquareCoords = null;
let legalMoves = [];

// Map piece types to Unicode
const getPieceUnicode = (type, color) => {
  const unicodePieces = {
    w: { p: "♙", r: "♖", n: "♘", b: "♗", q: "♕", k: "♔" },
    b: { p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚" },
  };
  return unicodePieces[color][type];
};

// Convert board indices to algebraic notation
const getAlgebraic = (row, col) => `${String.fromCharCode(97 + col)}${8 - row}`;

// Update status text based on turn
function updateStatus() {
  if (chess.game_over()) {
    if (chess.in_draw()) {
      statusEl.textContent = "Game over - Draw";
    } else {
      statusEl.textContent = "Game over - Checkmate";
    }
    return;
  }
  
  const turn = chess.turn();
  if (playerRole === turn) {
    statusEl.textContent = "Your turn – Make your move!";
  } else if (playerRole === "spectator") {
    statusEl.textContent = "You are a spectator. Watching the game.";
  } else if (playerRole) {
    statusEl.textContent = "Waiting for opponent's move…";
  }
}

// Render the chessboard UI
const renderBoard = () => {
  boardElement.innerHTML = "";
  const board = chess.board();

  legalMoves = selectedSquareCoords
    ? chess.moves({ square: getAlgebraic(selectedSquareCoords.row, selectedSquareCoords.col), verbose: true })
        .map(m => m.to)
    : [];

  board.forEach((row, rowIndex) => {
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

// Detect checkmate for modal or final state
const checkGameOver = () => {
  if (chess.game_over()) {
    if (chess.in_checkmate()) {
      const winner = chess.turn() === "w" ? "Black" : "White";
      displayGameOverModal(`Checkmate! ${winner} wins!`);
    } else if (chess.in_draw()) {
      displayGameOverModal("Game ended in a draw!");
    }
  }
};

// Display game over modal
const displayGameOverModal = (message) => {
  // Check if modal already exists
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
    // Update existing modal message
    modal.querySelector("p").textContent = message;
  }
  
  modal.style.display = "flex";
};

// Handle clicking on squares
const handleSquareClick = (square, row, col) => {
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

// Socket event handlers
socket.on("playerRole", (data) => {
  playerRole = data.role;
  statusEl.textContent = data.message;
  renderBoard();
});

socket.on("boardState", (fen) => {
  chess.load(fen);
  renderBoard();
});

socket.on("gameMessage", (message) => {
  statusEl.innerText = message;
});

socket.on("gameReset", (message) => {
  chess.reset();
  selectedSquareCoords = null;
  statusEl.innerText = message;
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
      statusEl.innerText = "Reset request declined";
    });
  }
});

document.getElementById("resetButton").addEventListener("click", () => {
  socket.emit("resetGameRequest");
  statusEl.innerText = "Waiting for opponent to accept reset...";
});

// Initial render
renderBoard();