import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: Server;

export const initSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ── Room joining ────────────────────────────────────────────────
    // Patient joins their personal room to receive assignment updates
    socket.on('join:patient', (patient_id: string) => {
      socket.join(`patient:${patient_id}`);
      console.log(`Patient ${patient_id} joined room`);
    });

    // Driver joins their personal room by user_id (for direct notifications)
    socket.on('join:driver', (user_id: string) => {
      socket.join(`driver:${user_id}`);
      // Also join the global drivers room for broadcast fallback
      socket.join('drivers');
      console.log(`Driver ${user_id} joined room driver:${user_id} + drivers`);
    });

    // Both patient & driver join the assignment room for tracking
    socket.on('join:assignment', (assignment_id: string) => {
      socket.join(`assignment:${assignment_id}`);
      console.log(`User joined assignment room: ${assignment_id}`);
    });

    // Admin joins broadcast room
    socket.on('join:admin', () => {
      socket.join('admin');
      console.log(`Admin joined global room`);
    });

    // ── Driver location broadcast ───────────────────────────────────
    // Drivers can also emit location directly via socket (in addition to REST)
    socket.on(
      'driver:location_update',
      (data: { assignment_id: string; latitude: number; longitude: number }) => {
        io.to(`assignment:${data.assignment_id}`).emit('driver:location_update', {
          ...data,
          timestamp: new Date().toISOString(),
        });
        // Also notify admin room
        io.to('admin').emit('driver:location_update', data);
      }
    );

    // ── Status change relay ─────────────────────────────────────────
    socket.on(
      'request:status_change',
      (data: { assignment_id: string; status: string }) => {
        io.to(`assignment:${data.assignment_id}`).emit(
          'request:status_change',
          data
        );
        io.to('admin').emit('request:status_change', data);
      }
    );

    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIo = (): Server => {
  if (!io) throw new Error('Socket.IO not initialized — call initSocket() first');
  return io;
};
