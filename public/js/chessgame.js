const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");

let playerRole = null;  // Stores the current player's role
let draggedPiece = null;  // Stores the currently dragged piece
let sourceSquare = null;  // Stores the source square coordinates

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
          if (playerRole && (playerRole === 'w' && square.color === 'w' || playerRole === 'b' && square.color === 'b')) {
            draggedPiece = pieceElement;
            sourceSquare = { row: rowIndex, col: squareIndex };  // Save source coordinates
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
};

// Listen for the playerRole event from the server
socket.on('playerRole', function(role) {
  playerRole = role;  // Set the player's role (w/b)
  console.log(`You are playing as: ${role === 'w' ? 'White' : 'Black'}`);
});

socket.on('spectatorRole', function() {
  playerRole = 'spectator';  // Set role as spectator
  console.log("You are a Spectator. You cannot make moves.");
});

// Listen for the reset event from the server
socket.on('gameReset', function() {
  console.log("Game has been reset.");
  chess.reset();  // Reset the chess game state on the client
  renderBoard();  // Re-render the initial chessboard
});

// Listen for board updates
socket.on('boardState', function (fen) {
  chess.load(fen);
  renderBoard();
});

// Function to reset the game (triggered by user input, like a button)
const resetGame = () => {
  if (playerRole !== 'spectator') {  // Only allow the players to reset the game
    socket.emit('resetGame');  // Notify the server to reset the game
  }
};

// Adding a button for the client to trigger the reset
document.getElementById('resetButton').addEventListener('click', resetGame);

// Function to handle piece movement (as before)
const handleMove = (source, target) => {
  if (playerRole === 'spectator') {
    console.log("Spectators cannot make moves.");
    return;  // Spectators can't make moves
  }

  const sourceSquare = `${String.fromCharCode(97 + source.col)}${ 8 - source.row }`;
  const targetSquare = `${String.fromCharCode(97 + target.col)}${ 8 - target.row }`;

  const move = chess.move({
    from: sourceSquare,
    to: targetSquare,
    promotion: "q",  // Always promote pawns to queens for simplicity
  });

  if (move) {
    renderBoard();  // Re-render the board
    socket.emit("move", move);  // Send the move to the server
  } else {
    console.error("Invalid move");
  }
};

// Initial board render
renderBoard();
