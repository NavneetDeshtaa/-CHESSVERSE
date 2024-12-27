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

io.on('connection', function (socket) {
    console.log('connected');

    // Assigning players
    if (!players.white) {
        players.white = socket.id;
        socket.emit('playerRole', 'w');
    } else if (!players.black) {
        players.black = socket.id;
        socket.emit('playerRole', 'b');
    } else {
        socket.emit('spectatorRole');
    }

    // Resetting the game state
    socket.on('resetGame', () => {
        console.log('Resetting game...');
        chess.reset(); // Reset the chess game state
        io.emit('boardState', chess.fen()); // Notify all clients with the reset game state
        io.emit('gameReset'); // Optionally notify clients to reset their interface
    });

    // Handling moves
    socket.on('move', (move) => {
        try {
            const result = chess.move(move);
            if (result) {
                io.emit('move', move);
                io.emit('boardState', chess.fen());
            } else {
                socket.emit('invalidMove', move);
            }
        } catch (error) {
            console.log(error);
            socket.emit("Invalid move:", move);
        }
    });

    socket.on('disconnect', () => {
        if (socket.id === players.white) {
            delete players.white;
        } else if (socket.id === players.black) {
            delete players.black;
        }
    });
});

// Server listens for connections
server.listen(process.env.PORT || 3000, function () {
    console.log('Server is running on port 3000');
});
