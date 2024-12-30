const express = require('express');
const path = require('path');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');

let rooms = {};

// WebSocket server for signaling
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    let currentRoomId = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const { roomId, type, payload } = data;

            if (!rooms[roomId]) {
                rooms[roomId] = [];
            }

            if (!currentRoomId) {
                currentRoomId = roomId;
                rooms[roomId].push(ws);
                console.log(`User joined room: ${roomId}`);
            }

            if (type === 'leave') {
                // Remove the user from the room and notify others
                rooms[roomId] = rooms[roomId].filter((client) => client !== ws);
                console.log(`User left room: ${roomId}`);
                rooms[roomId].forEach((client) => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'user-left',
                            payload: { roomId },
                        }));
                    }
                });
            } else if (type === 'chat') {
                // Broadcast the chat message to all clients in the room
                rooms[roomId].forEach((client) => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'chat', payload: { message: payload.message } }));
                    }
                });
            } else {
                // Handle other types like 'offer', 'answer', 'candidate'
                rooms[roomId].forEach((client) => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type, payload }));
                    }
                });
            }
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
        }
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
        if (currentRoomId && rooms[currentRoomId]) {
            rooms[currentRoomId] = rooms[currentRoomId].filter((client) => client !== ws);

            if (rooms[currentRoomId].length === 0) {
                delete rooms[currentRoomId];
                console.log(`Room ${currentRoomId} deleted`);
            }
        }
    });
});

// API to create a meeting
app.post('/create-meeting', (req, res) => {
    const roomId = uuidv4();
    rooms[roomId] = [];
    res.status(201).send({ link: `http://localhost:3000/meet/${roomId}` });
});

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Serve the meeting page for dynamic room routes
app.get('/meet/:roomId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
server.listen(3000, () => {
    console.log('Server running on port 3000');
});
