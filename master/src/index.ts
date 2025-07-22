import { Ableton } from "ableton-js";
import * as dgram from "dgram";

const MULTICAST_GROUP = "224.0.1.100";
const MULTICAST_PORT = 8080;

interface TransportMessage {
  isPlaying: boolean;
  position: number;
  tempo: number;
  timestamp: number; // Add timestamp for better sync
}

async function runMaster() {
  const ableton = new Ableton({ logger: console });
  await ableton.start();
  const song = ableton.song;

  // Create UDP socket for multicast
  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

  socket.bind(() => {
    socket.setMulticastTTL(128);
    socket.setMulticastLoopback(true);
    console.log(
      `[Master] UDP Multicast uruchomiony na ${MULTICAST_GROUP}:${MULTICAST_PORT}`
    );
  });

  let prevData: Omit<TransportMessage, "timestamp"> | null = null;

  const broadcast = (data: Omit<TransportMessage, "timestamp">) => {
    // Skip if data hasn't changed (except for periodic position updates)
    if (
      prevData &&
      prevData.isPlaying === data.isPlaying &&
      Math.abs(prevData.position - data.position) < 0.01 && // Allow small position changes
      prevData.tempo === data.tempo
    ) {
      return;
    }

    prevData = data;
    const message: TransportMessage = {
      ...data,
      timestamp: Date.now(),
    };

    const payload = JSON.stringify(message);
    console.log("[BROADCAST] Wysylam wiadomosc UDP Multicast:", payload);

    socket.send(payload, MULTICAST_PORT, MULTICAST_GROUP, (err) => {
      if (err) {
        console.error("[Master] Błąd wysyłania UDP:", err);
      }
    });
  };

  // Listen for transport changes
  song.addListener("is_playing", async (isPlaying: boolean) => {
    const position = await song.get("current_song_time");
    const tempo = await song.get("tempo");
    const message = { isPlaying, position, tempo };
    console.log(
      `[Master] Stan "is_playing" się zmienił: ${JSON.stringify(message)}`
    );
    broadcast(message);
  });

  song.addListener("current_song_time", async (position: number) => {
    const isPlaying = await song.get("is_playing");
    const tempo = await song.get("tempo");
    const message = { isPlaying, position, tempo };

    // Only log position changes if significant or playback state changed
    if (
      !prevData ||
      prevData.isPlaying !== isPlaying ||
      Math.abs(prevData.position - position) > 1
    ) {
      console.log(`[Master] Pozycja się zmieniła: ${JSON.stringify(message)}`);
    }
    broadcast(message);
  });

  // Send periodic sync messages to ensure slaves stay in sync
  setInterval(async () => {
    try {
      const isPlaying = await song.get("is_playing");
      const position = await song.get("current_song_time");
      const tempo = await song.get("tempo");

      broadcast({ isPlaying, position, tempo });
    } catch (error) {
      console.error("[Master] Błąd podczas okresowej synchronizacji:", error);
    }
  }, 1000); // Send sync every second

  // Cleanup on exit
  process.on("SIGINT", () => {
    console.log("[Master] Zamykanie serwera UDP...");
    socket.close(() => {
      process.exit(0);
    });
  });

  process.on("SIGTERM", () => {
    console.log("[Master] Zamykanie serwera UDP...");
    socket.close(() => {
      process.exit(0);
    });
  });
}

runMaster().catch(console.error);
