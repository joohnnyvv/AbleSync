import { Ableton } from "ableton-js";
import * as dgram from "dgram";

const MULTICAST_GROUP = "224.0.1.100";
const MULTICAST_PORT = 8080;

interface TransportMessage {
  isPlaying: boolean;
  position: number;
  tempo: number;
  timestamp: number;
}

async function runMaster() {
  const ableton = new Ableton({ logger: console });
  await ableton.start();
  const song = ableton.song;

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
    if (
      prevData &&
      prevData.isPlaying === data.isPlaying &&
      Math.abs(prevData.position - data.position) < 0.001 &&
      prevData.tempo === data.tempo
    ) {
      return;
    }

    prevData = data;
    const message: TransportMessage = {
      ...data,
      timestamp: Date.now(),
    };

    if (data.isPlaying) {
      console.log(`[Master] Wysyła wiadomość UDP: ${JSON.stringify(message)}`);
    }

    const payload = JSON.stringify(message);

    socket.send(payload, MULTICAST_PORT, MULTICAST_GROUP, (err) => {
      if (err) {
        console.error("[Master] Błąd wysyłania UDP:", err);
      }
    });
  };

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

    broadcast(message);
  });

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

runMaster().catch();
