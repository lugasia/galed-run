import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const port = process.env.WS_PORT || 3001;
const wss = new WebSocketServer({ port: Number(port) });

wss.on('connection', (ws) => {
  console.log('New client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      // Broadcast the message to all connected clients
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === ws.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

console.log(`WebSocket server started on port ${port}`); 