import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const port = process.env.PORT || 3001;
const wss = new WebSocketServer({ port: Number(port) });

// Handle process termination
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing WebSocket server...');
  wss.close(() => {
    console.log('WebSocket server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Closing WebSocket server...');
  wss.close(() => {
    console.log('WebSocket server closed');
    process.exit(0);
  });
});

wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});

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

  ws.on('error', (error) => {
    console.error('WebSocket connection error:', error);
  });

  // Send initial connection message
  ws.send(JSON.stringify({ type: 'CONNECTED' }));
});

console.log(`WebSocket server started on port ${port}`); 