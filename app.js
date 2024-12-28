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
    console.log('connected:', socket.id);

    if (!players.white) {
        players.white = socket.id;
        socket.emit('playerRole', { role: 'w', message: 'You are playing as White. Waiting for another player...' });
    } else if (!players.black) {
        players.black = socket.id;
        socket.emit('playerRole', { role: 'b', message: 'You are playing as Black. Start playing!' });
        io.to(players.white).emit('playerRole', { role: 'w', message: 'Player has joined. Start playing!' });
    } else {
        socket.emit('playerRole', { role: 'spectator', message: 'You are a Spectator. You cannot make moves.' });
    }

    socket.emit('boardState', chess.fen());

    socket.on('move', (move) => {
        if ((socket.id === players.white && chess.turn() === 'w') || 
            (socket.id === players.black && chess.turn() === 'b')) {
            const result = chess.move(move);
            if (result) {
                io.emit('move', move);
                io.emit('boardState', chess.fen());
            } else {
                socket.emit('invalidMove', move);
            }
        } else {
            socket.emit('invalidMove', 'Not your turn or invalid move');
        }
    });

    socket.on('resetGame', () => {
        if (socket.id === players.white || socket.id === players.black) {
            chess.reset();
            io.emit('boardState', chess.fen());
            io.emit('gameReset', 'The game has been reset.');
        }
    });

    socket.on('disconnect', () => {
        if (socket.id === players.white) {
            delete players.white;
            io.emit('gameMessage', 'White player has disconnected.');
        } else if (socket.id === players.black) {
            delete players.black;
            io.emit('gameMessage', 'Black player has disconnected.');
        }
    });
});

server.listen(process.env.PORT || 3000, function () {
    console.log('Server is running on port 3000');
});
