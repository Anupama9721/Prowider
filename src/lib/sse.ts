/**
 * Simple in-process event emitter for SSE connections.
 * In production with multiple instances, replace with Redis pub/sub.
 */

class EventEmitter {
  constructor() {
    this.clients = new Set();
  }

  addClient(writer) {
    this.clients.add(writer);
    return () => this.clients.delete(writer);
  }

  emit(eventName, data) {
    const message = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    const dead = [];
    for (const writer of this.clients) {
      try {
        writer.write(message);
      } catch {
        dead.push(writer);
      }
    }
    for (const w of dead) this.clients.delete(w);
  }

  get clientCount() {
    return this.clients.size;
  }
}

// Singleton
const globalForEmitter = globalThis;
if (!globalForEmitter.__sseEmitter) {
  globalForEmitter.__sseEmitter = new EventEmitter();
}

export const sseEmitter = globalForEmitter.__sseEmitter;
