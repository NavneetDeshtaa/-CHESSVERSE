const express = require('express');
const socket = require('socket.io');
const http = require('http');
const { Chess } = require('chess.js');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socket(server);

const chess = new Chess();
let players = {}; 

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index', { title: "Chess Game" });
});

io.on('connection', (socket) => {
    console.log('Connected:', socket.id);

    // Assign roles to players or spectators
    if (!players.white) {
        players.white = socket.id;
        socket.emit('playerRole', { role: 'w', message: 'You are White. Waiting for another player...' });
    } else if (!players.black) {
        players.black = socket.id;
        socket.emit('playerRole', { role: 'b', message: 'You are Black. Waiting for White to make the first move.' });

        // Notify White it's their turn to move
        io.to(players.white).emit('gameMessage', 'Your turn.');
    } else {
        socket.emit('playerRole', { role: 'spectator', message: 'You are a Spectator. Watch the game unfold!' });
    }

    // Send the current board state to the new connection
    socket.emit('boardState', chess.fen());

    // Handle player moves
    socket.on('move', (move) => {
        const isPlayerTurn = 
            (socket.id === players.white && chess.turn() === 'w') ||
            (socket.id === players.black && chess.turn() === 'b');

        if (isPlayerTurn) {
            const result = chess.move(move);
            if (result) {
                io.emit('boardState', chess.fen());

                const currentPlayer = chess.turn() === 'w' ? players.white : players.black;
                const waitingPlayer = chess.turn() === 'w' ? players.black : players.white;

                io.to(currentPlayer).emit('gameMessage', 'Your turn.');
                io.to(waitingPlayer).emit('gameMessage', 'Waiting for the other player to move.');
            } else {
                socket.emit('gameMessage', 'Invalid move. Try again.');
            }
        } else {
            socket.emit('gameMessage', 'It is not your turn.');
        }
    });

    // Handle game reset requests
    socket.on('resetGameRequest', () => {
        if (socket.id === players.white || socket.id === players.black) {
            const otherPlayer = socket.id === players.white ? players.black : players.white;
            io.to(otherPlayer).emit('resetRequest', socket.id);
        }
    });

    socket.on('resetGameResponse', (response) => {
        const otherPlayer = socket.id === players.white ? players.black : players.white;

        if (response === 'accept') {
            chess.reset();
            io.emit('boardState', chess.fen());
            io.emit('gameReset', 'The game has been reset.');
            io.to(players.white).emit('gameMessage', 'Your turn.');
            io.to(players.black).emit('gameMessage', 'Waiting for White to move.');
        } else if (response === 'reject') {
            io.to(socket.id).emit('gameMessage', 'You rejected the reset request.');
            io.to(otherPlayer).emit('gameMessage', 'Your reset request was rejected by the other player.');
        }
    });

    // Handle player disconnections
    socket.on('disconnect', () => {
        console.log('Disconnected:', socket.id);

        if (socket.id === players.white) {
            delete players.white;
            io.emit('gameMessage', 'White player has disconnected. The game is over.');
            chess.reset();
            io.emit('boardState', chess.fen());
        } else if (socket.id === players.black) {
            delete players.black;
            io.emit('gameMessage', 'Black player has disconnected. The game is over.');
            chess.reset();
            io.emit('boardState', chess.fen());
        } else {
            console.log('A spectator disconnected.');
        }
    });
});

server.listen(process.env.PORT || 3000, () => {
    console.log('Server is running on port 3000');
});
