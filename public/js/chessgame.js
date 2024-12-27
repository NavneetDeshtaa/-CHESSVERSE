const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");

let playerRole = null;  


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


socket.on('playerRole', function(role) {
  playerRole = role;  
  console.log(`You are playing as: ${role === 'w' ? 'White' : 'Black'}`);
  document.getElementById('role').innerText = `You are playing as: ${role === 'w' ? 'White' : 'Black'}`;  

  renderBoard();  
});

socket.on('spectatorRole', function() {
  playerRole = 'spectator';  
  console.log("You are a Spectator. You cannot make moves.");
  document.getElementById('role').innerText = 'You are a Spectator. You cannot make moves.';
});


socket.on('gameReset', function() {
  console.log("Game has been reset.");
  chess.reset();  
  renderBoard(); 
});


socket.on('boardState', function (fen) {
  chess.load(fen);
  renderBoard();
});


const resetGame = () => {
  if (playerRole !== 'spectator') {  
    socket.emit('resetGame'); 
  }
};


document.getElementById('resetButton').addEventListener('click', resetGame);


const handleMove = (source, target) => {
  if (playerRole === 'spectator') {
    console.log("Spectators cannot make moves.");
    return;  
  }

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

renderBoard();
