const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;

// Unicode pieces mapping
const getPieceUnicode = (type, color) => {
  const unicodePieces = {
    w: {
      p: "♙",
      r: "♖",
      n: "♘",
      b: "♗",
      q: "♕",
      k: "♔",
    },
    b: {
      p: "♟",
      r: "♜",
      n: "♞",
      b: "♝",
      q: "♛",
      k: "♚",
    },
  };
  return unicodePieces[color][type];
};

// Function to render the board
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
        pieceElement.draggable = playerRole === square.color;

        pieceElement.addEventListener("dragstart", (e) => {
          draggedPiece = pieceElement;
          sourceSquare = { row: rowIndex, col: squareIndex };
          e.dataTransfer.setData("text/plain", "");
        });

        pieceElement.addEventListener("touchstart", (e) => {
          draggedPiece = pieceElement;
          sourceSquare = { row: rowIndex, col: squareIndex };
          e.preventDefault();  // Prevent default behavior for touch
        });

        squareElement.appendChild(pieceElement);
      }

      squareElement.addEventListener("dragover", (e) => e.preventDefault());
      squareElement.addEventListener("drop", () => {
        if (draggedPiece) {
          handleMove(
            sourceSquare,
            { row: rowIndex, col: squareIndex }
          );
        }
      });

      squareElement.addEventListener("touchstart", (e) => {
        if (draggedPiece) {
          handleMove(sourceSquare, { row: rowIndex, col: squareIndex });
          e.preventDefault();  // Prevent default behavior for touch
        }
      });

      boardElement.appendChild(squareElement);
    });
  });

  boardElement.classList.toggle("flipped", playerRole === "b");
};

const handleMove = (source, target) => {
  const sourceSquare = `${String.fromCharCode(97 + source.col)}${ 8 - source.row }`;
  const targetSquare = `${String.fromCharCode(97 + target.col)}${ 8 - target.row }`;

  const move = chess.move({
    from: sourceSquare,
    to: targetSquare,
    promotion: "q",
  });

  if (move) {
    renderBoard();
    socket.emit("move", move);
  } else {
    console.error("Invalid move");
  }
};

socket.on("playerRole", function (role) {
  playerRole = role;
  renderBoard();
});

socket.on("spectatorRole", function () {
  playerRole = null;
  renderBoard();
});

socket.on("boardState", function (fen) {
  chess.load(fen);
  renderBoard();
});

socket.on("move", function (move) {
  chess.move(move);
  renderBoard();
});

renderBoard();
