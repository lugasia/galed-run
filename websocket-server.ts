import { WebSocket, WebSocketServer } from 'ws';
import { createServer } from 'http';

const server = createServer();
const wss = new WebSocketServer({ server });

const clients = new Set<WebSocket>();

wss.on('connection', (ws: WebSocket) => {
  clients.add(ws);

  ws.on('close', () => {
    clients.delete(ws);
  });

  ws.on('message', (message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());
      
      // Broadcast location updates to all connected clients
      if (data.type === 'LOCATION_UPDATE') {
        const broadcastData = JSON.stringify({
          type: 'LOCATION_UPDATE',
          teamId: data.teamId,
          coordinates: data.coordinates,
        });

        clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(broadcastData);
          }
        });
      }
      
      // Broadcast new events to all connected clients
      if (data.type === 'NEW_EVENT') {
        const broadcastData = JSON.stringify({
          type: 'NEW_EVENT',
          event: data.event,
        });

        clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(broadcastData);
          }
        });
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });

  // Send initial connection message
  ws.send(JSON.stringify({ type: 'CONNECTED' }));
});

// Keep-alive ping to prevent timeouts
setInterval(() => {
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.ping();
    }
  });
}, 30000);

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`WebSocket server is running on port ${PORT}`);
}); 