import { Ableton } from "ableton-js";
import * as dgram from "dgram";

const MULTICAST_GROUP = "224.0.1.100";
const MULTICAST_PORT = 8080;
const SYNC_TIMEOUT = 5000; // 5 seconds timeout for sync messages

interface TransportMessage {
  isPlaying: boolean;
  position: number;
  tempo: number;
  timestamp: number;
}

async function runSlave() {
  const ableton = new Ableton({ logger: console });
  await ableton.start();
  const song = ableton.song;

  // Create UDP socket for multicast
  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

  let lastSyncTime = Date.now();
  let isConnected = false;

  socket.bind(MULTICAST_PORT, () => {
    socket.addMembership(MULTICAST_GROUP);
    console.log(
      `[Slave] Nasłuchiwanie UDP Multicast na ${MULTICAST_GROUP}:${MULTICAST_PORT}`
    );
  });

  socket.on("message", async (buffer, rinfo) => {
    try {
      const msg: TransportMessage = JSON.parse(buffer.toString());
      lastSyncTime = Date.now();

      if (!isConnected) {
        console.log(
          `[Slave] Połączono z masterem (${rinfo.address}:${rinfo.port})`
        );
        isConnected = true;
      }

      const currentPosition = await song.get("current_song_time");
      const isPlaying = await song.get("is_playing");
      const currentTempo = await song.get("tempo");

      // Calculate message age to compensate for network delay
      const messageAge = (Date.now() - msg.timestamp) / 1000;
      let adjustedPosition = msg.position;

      // If master is playing, adjust position for network delay
      if (msg.isPlaying) {
        adjustedPosition += messageAge;
      }

      const positionDiff = Math.abs(currentPosition - adjustedPosition);
      const shouldUpdatePosition = positionDiff > 0.1; // Reduced threshold for tighter sync
      const tempoDiff = Math.abs(currentTempo - msg.tempo);

      console.log(
        `[Slave] Otrzymano: playing=${msg.isPlaying}, position=${
          msg.position
        }→${adjustedPosition.toFixed(3)}, tempo=${msg.tempo}, delay=${(
          messageAge * 1000
        ).toFixed(1)}ms`
      );

      if (positionDiff > 0.05) {
        // Only log significant position differences
        console.log(
          `[Slave] Pozycja: aktualna=${currentPosition.toFixed(
            3
          )}, różnica=${positionDiff.toFixed(3)}`
        );
      }

      // Update position if needed
      if (shouldUpdatePosition) {
        await song.set("current_song_time", adjustedPosition);
        console.log(
          `[Slave] Ustawiono pozycję na ${adjustedPosition.toFixed(3)}`
        );
      }

      // Update playback state
      if (msg.isPlaying !== isPlaying) {
        await song.set("is_playing", msg.isPlaying);
        console.log(
          `[Slave] ${msg.isPlaying ? "Włączono" : "Zatrzymano"} odtwarzanie`
        );
      }

      // Update tempo if needed
      if (tempoDiff > 0.01) {
        await song.set("tempo", msg.tempo);
        console.log(`[Slave] Dostosowano tempo do ${msg.tempo}`);
      }
    } catch (error) {
      console.error("[Slave] Błąd przetwarzania wiadomości UDP:", error);
    }
  });

  socket.on("error", (err) => {
    console.error("[Slave] Błąd UDP socket:", err);
  });

  // Monitor connection status
  setInterval(() => {
    const timeSinceLastSync = Date.now() - lastSyncTime;

    if (isConnected && timeSinceLastSync > SYNC_TIMEOUT) {
      console.log("[Slave] Utracono połączenie z masterem");
      isConnected = false;
    }
  }, 1000);

  // Cleanup on exit
  process.on("SIGINT", () => {
    console.log("[Slave] Zamykanie klienta UDP...");
    socket.dropMembership(MULTICAST_GROUP);
    socket.close(() => {
      process.exit(0);
    });
  });

  process.on("SIGTERM", () => {
    console.log("[Slave] Zamykanie klienta UDP...");
    socket.dropMembership(MULTICAST_GROUP);
    socket.close(() => {
      process.exit(0);
    });
  });
}

runSlave().catch(console.error);
