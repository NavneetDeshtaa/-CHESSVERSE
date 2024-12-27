const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");


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
                pieceElement.draggable = true;

                pieceElement.addEventListener("dragstart", (e) => {
                    draggedPiece = pieceElement;
                    sourceSquare = { row: rowIndex, col: squareIndex };
                    e.dataTransfer.setData("text/plain", "");
                });

                squareElement.appendChild(pieceElement);
            }

            squareElement.addEventListener("dragover", (e) => e.preventDefault());
            squareElement.addEventListener("drop", () => {
                if (draggedPiece) {
                    handleMove(sourceSquare, { row: rowIndex, col: squareIndex });
                }
            });

            boardElement.appendChild(squareElement);
        });
    });
};

// Listen for the reset event from the server
socket.on('gameReset', function() {
    console.log("Game has been reset.");
    chess.reset(); // Reset the chess game state on the client
    renderBoard(); // Re-render the initial chessboard
});

// Listen for board updates
socket.on('boardState', function (fen) {
    chess.load(fen);
    renderBoard();
});

// Function to reset the game (triggered by user input, like a button)
const resetGame = () => {
    socket.emit('resetGame'); // Notify the server to reset the game
};

// Adding a button for the client to trigger the reset
document.getElementById('resetButton').addEventListener('click', resetGame);

// Function to handle piece movement (as before)
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

// Initial board render
renderBoard();
