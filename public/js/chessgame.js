const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");
const roleElement = document.getElementById("role");

let playerRole = null;
let resetRequestPending = false;
let resetMessageDisplayed = false;
let selectedSquareCoords = null; 
let legalMoves = []; 

const getPieceUnicode = (type, color) => {
  const unicodePieces = {
    w: { p: "♙", r: "♖", n: "♘", b: "♗", q: "♕", k: "♔" },
    b: { p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚" },
  };
  return unicodePieces[color][type];
};

const getAlgebraic = (row, col) => {
  return `${String.fromCharCode(97 + col)}${8 - row}`;
};

const renderBoard = () => {
  const board = chess.board();
  boardElement.innerHTML = "";

  if (selectedSquareCoords) {
    const sourceAlg = getAlgebraic(selectedSquareCoords.row, selectedSquareCoords.col);
    legalMoves = chess.moves({ square: sourceAlg, verbose: true }).map(move => move.to);
  } else {
    legalMoves = [];
  }

  board.forEach((row, rowIndex) => {
    row.forEach((square, colIndex) => {
      const squareElement = document.createElement("div");
      squareElement.classList.add("square", (rowIndex + colIndex) % 2 === 0 ? "light" : "dark");
      squareElement.dataset.row = rowIndex;
      squareElement.dataset.col = colIndex;

      if (
        selectedSquareCoords &&
        selectedSquareCoords.row === rowIndex &&
        selectedSquareCoords.col === colIndex
      ) {
        squareElement.classList.add("selected");
      }

      const currentSquareAlg = getAlgebraic(rowIndex, colIndex);
      if (legalMoves.includes(currentSquareAlg)) {
        squareElement.classList.add("legal-move");
      }

      if (square) {
        const pieceElement = document.createElement("div");
        pieceElement.classList.add("piece", square.color === "w" ? "white" : "black");
        pieceElement.innerText = getPieceUnicode(square.type, square.color);
        squareElement.appendChild(pieceElement);
      }

      squareElement.addEventListener("click", () => {
        const clickedSquare = {
          row: parseInt(squareElement.dataset.row),
          col: parseInt(squareElement.dataset.col)
        };

        const clickedSquareAlg = getAlgebraic(clickedSquare.row, clickedSquare.col);

        if (!selectedSquareCoords) {
          if (square && playerRole &&
              ((playerRole === "w" && square.color === "w") ||
               (playerRole === "b" && square.color === "b"))
          ) {
            selectedSquareCoords = clickedSquare;
            renderBoard();
          }
        } else {
          if (
            selectedSquareCoords.row === clickedSquare.row &&
            selectedSquareCoords.col === clickedSquare.col
          ) {
            selectedSquareCoords = null;
            renderBoard();
            return;
          }

          if (square && playerRole &&
              ((playerRole === "w" && square.color === "w") ||
               (playerRole === "b" && square.color === "b"))
          ) {
            selectedSquareCoords = clickedSquare;
            renderBoard();
            return;
          }

          if (!legalMoves.includes(clickedSquareAlg)) {
            return;
          }

          handleMove(selectedSquareCoords, clickedSquare);
          selectedSquareCoords = null;
          renderBoard();
        }
      });

      boardElement.appendChild(squareElement);
    });
  });

  boardElement.classList.toggle("flipped", playerRole === "b");
  document.getElementById("resetButton").style.display =
    playerRole === "spectator" ? "none" : "block";
};

socket.on("playerRole", function (data) {
  playerRole = data.role;

  if (playerRole === "w") {
    roleElement.innerText = "Waiting for another player...";
  } else if (playerRole === "b") {
    roleElement.innerText = "Waiting for White player to make their move.";
  } else if (playerRole === "spectator") {
    roleElement.innerText = "You are a spectator. Watch the game unfold!";
  }
  renderBoard();
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

socket.on("resetRequest", () => {
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

  const sourceSquare = getAlgebraic(source.row, source.col);
  const targetSquare = getAlgebraic(target.row, target.col);

  socket.emit("move", { from: sourceSquare, to: targetSquare, promotion: "q" });

  if (resetMessageDisplayed) {
    resetMessageDisplayed = false;
    roleElement.innerText = "";
  }
};

renderBoard();
