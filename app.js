const express = require('express');
const socket = require('socket.io');
const http = require('http');
const { Chess } = require('chess.js');
const path = require('path');

const app = express();

const server = http.createServer(app);
const io = socket(server);

const chess = new Chess();
let players = {}; // Object to track the players
let currentPlayer = "w"; // Track the current player's turn

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index', { title: "Chess Game" });
});

io.on('connection', function (uniquesocket) {
    console.log('A player connected: ' + uniquesocket.id);

    // Assign roles when a player connects
    if (!players.white) {
        players.white = uniquesocket.id; // First player as white
        uniquesocket.emit('playerRole', 'w'); // Send white role to the first player
    } else if (!players.black) {
        players.black = uniquesocket.id; // Second player as black
        uniquesocket.emit('playerRole', 'b'); // Send black role to the second player
    } else {
        // If both players are already in, the next player will be a spectator
        uniquesocket.emit('spectatorRole');
    }

    // Handle disconnections
    uniquesocket.on('disconnect', function () {
        if (uniquesocket.id === players.white) {
            delete players.white;
        } else if (uniquesocket.id === players.black) {
            delete players.black;
        }
        console.log('Player disconnected:', uniquesocket.id);
    });

    // Handle move from players
    uniquesocket.on('move', (move) => {
        try {
            if (chess.turn() === 'w' && uniquesocket.id !== players.white) return;
            if (chess.turn() === 'b' && uniquesocket.id !== players.black) return;

            const result = chess.move(move);
            if (result) {
                currentPlayer = chess.turn();
                io.emit('move', move);
                io.emit('boardState', chess.fen());
            } else {
                console.log("Invalid move:", move);
                uniquesocket.emit('invalidMove', move);
            }
        } catch (error) {
            console.log(error);
            uniquesocket.emit("Invalid move:", move);
        }
    });
});

server.listen(process.env.PORT || 3000, function () {
    console.log('listening on PORT ' + (process.env.PORT || 3000));
});
