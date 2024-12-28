const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");
const roleElement = document.getElementById("role");
let playerRole = null;
let draggedPiece = null;
let sourceSquare = null;
let resetMessageShown = false; // Track if reset message is displayed

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
          if (playerRole && (playerRole === 'w' && square.color === 'w' || playerRole === 'b' && square.color === 'b')) {
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

  if (playerRole === 'b') {
    boardElement.classList.add('flipped');
  } else {
    boardElement.classList.remove('flipped');
  }
};

socket.on('playerRole', function(data) {
  playerRole = data.role;
  roleElement.innerText = data.message;
  renderBoard();
});

socket.on('boardState', function(fen) {
  chess.load(fen);
  renderBoard();
});

socket.on('gameReset', function(message) {
  chess.reset();
  roleElement.innerText = message;
  resetMessageShown = true; // Reset message is displayed
  renderBoard();
});

socket.on('gameMessage', function(message) {
  roleElement.innerText = message;
});

socket.on('invalidMove', function(move) {
  console.error("Invalid move:", move);
});

const resetGame = () => {
  if (playerRole !== 'spectator') {
    socket.emit('resetGame');
  }
};

document.getElementById('resetButton').addEventListener('click', resetGame);

const handleMove = (source, target) => {
  if (playerRole === 'spectator') return;

  const sourceSquare = `${String.fromCharCode(97 + source.col)}${8 - source.row}`;
  const targetSquare = `${String.fromCharCode(97 + target.col)}${8 - target.row}`;

  socket.emit("move", { from: sourceSquare, to: targetSquare, promotion: "q" });

  // Clear reset message on the first valid move after reset
  if (resetMessageShown) {
    roleElement.innerText = '';
    resetMessageShown = false;
  }
};

renderBoard();
