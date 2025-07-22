const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");
const Message = document.getElementById("role");
let playerRole = null;
let selectedSquareCoords = null;
let legalMoves = [];

const getPieceUnicode = (type, color) => ({
  w: { p: "♙", r: "♖", n: "♘", b: "♗", q: "♕", k: "♔" },
  b: { p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚" },
})[color][type];

const getAlgebraic = (row, col) => `${String.fromCharCode(97 + col)}${8 - row}`;

const renderBoard = () => {
  boardElement.innerHTML = "";
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const sq = document.createElement("div");
      const square = chess.get(getAlgebraic(i, j));
      const algebraic = getAlgebraic(i, j);
      sq.className = `square ${(i + j) % 2 === 0 ? "light" : "dark"}`;
      sq.dataset.row = i;
      sq.dataset.col = j;

      if (selectedSquareCoords?.row === i && selectedSquareCoords?.col === j) sq.classList.add("selected");
      if (legalMoves.includes(algebraic)) sq.classList.add("legal-move");

      if (square) {
        const piece = document.createElement("div");
        piece.className = `piece ${square.color === "w" ? "white" : "black"}`;
        piece.textContent = getPieceUnicode(square.type, square.color);
        sq.appendChild(piece);
      }

      sq.addEventListener("click", () => handleSquareClick(square, i, j));
      boardElement.appendChild(sq);
    }
  }

  boardElement.classList.toggle("flipped", playerRole === "b");
  document.getElementById("resetButton").style.display = playerRole === "spectator" ? "none" : "block";
};

const handleSquareClick = (square, row, col) => {
  if (playerRole !== chess.turn()) return;
  if (!selectedSquareCoords) {
    if (square && square.color === playerRole) {
      selectedSquareCoords = { row, col };
      legalMoves = chess
        .moves({ square: getAlgebraic(row, col), verbose: true })
        .map((m) => m.to);
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
    legalMoves = [];
  }
  renderBoard();
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
    modalContent.appendChild(messageElem);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
  }
  modal.querySelector("p").textContent = message;
  modal.style.display = "flex";
};

// Socket Events
socket.on("playerRole", ({ role, message }) => {
  playerRole = role;
  Message.textContent = message;
  renderBoard();
});

socket.on("boardState", (fen) => {
  chess.load(fen);
  renderBoard();
});

socket.on("gameMessage", (message) => (Message.innerText = message));

socket.on("gameReset", (message) => {
  chess.reset();
  selectedSquareCoords = null;
  legalMoves = [];
  Message.innerText = message;
  const modal = document.getElementById("gameOverModal");
  if (modal) modal.remove();
  renderBoard();
});

socket.on("gameOver", (message) => displayGameOverModal(message));

socket.on("resetRequest", () => {
  if (playerRole === "spectator") return;
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
    socket.emit("resetGameResponse", "reject");
    confirmDiv.remove();
  });
});

document.getElementById("resetButton").addEventListener("click", () => {
  const resetButton = document.getElementById("resetButton");

  resetButton.disabled = true;
  resetButton.textContent = "Request Sent. Try Again After Sometime";
  socket.emit("resetGameRequest");

  setTimeout(() => {
    resetButton.disabled = false;
    resetButton.textContent = "Reset Game";
  }, 6000);
});

renderBoard();