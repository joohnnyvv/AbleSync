import { Ableton } from "ableton-js";
import * as dgram from "dgram";

const MULTICAST_GROUP = "224.0.1.100";
const MULTICAST_PORT = 8080;
const SYNC_TIMEOUT = 5000;
const TEMPO_THRESHOLD = 0.3;

let POSITION_SYNC_THRESHOLD = parseFloat(process.env.SYNC_THRESHOLD || "0.01");

interface TransportMessage {
  isPlaying: boolean;
  position: number;
  tempo: number;
  timestamp: number;
}

interface ThresholdMessage {
  type: "threshold";
  value: number;
}

async function runSlave() {
  const ableton = new Ableton({ logger: console });
  await ableton.start();
  const song = ableton.song;

  console.log(
    `[Slave] Uruchomiony z progiem synchronizacji: ${POSITION_SYNC_THRESHOLD}`
  );

  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

  let lastSyncTime = Date.now();
  let isConnected = false;

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (data) => {
    try {
      const lines = data.toString().trim().split("\n");
      for (const line of lines) {
        if (line.trim()) {
          const message: ThresholdMessage = JSON.parse(line);
          if (
            message.type === "threshold" &&
            typeof message.value === "number"
          ) {
            POSITION_SYNC_THRESHOLD = message.value;
            console.log(
              `[Slave] Próg synchronizacji zaktualizowany na: ${POSITION_SYNC_THRESHOLD}`
            );
          }
        }
      }
    } catch (error) {
      console.error("Error parsing threshold update:", error);
    }
  });

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

      if (Math.abs(currentTempo - msg.tempo) > TEMPO_THRESHOLD) {
        await song.set("tempo", msg.tempo);
      }

      if (isPlaying !== msg.isPlaying) {
        await song.set("is_playing", msg.isPlaying);
      }

      if (!msg.isPlaying || (msg.isPlaying && !isPlaying)) {
        await song.set("current_song_time", msg.position);
      } else if (msg.isPlaying) {
        console.log("Odebrany timestamp:", msg.timestamp);
        console.log("Aktualny timestamp:", Date.now());

        const networkLatency = (Date.now() - msg.timestamp) / 2;

        const masterPosition =
          msg.position + (networkLatency / 60000) * msg.tempo;

        console.log("Skorygowana pozycja Mastera:", masterPosition);
        console.log("Pozycja Slava:", currentPosition);

        const positionDiff = masterPosition - currentPosition;

        console.log("Rożnica pozycji:", positionDiff);
        console.log("Używany próg synchronizacji:", POSITION_SYNC_THRESHOLD);

        if (Math.abs(positionDiff) > POSITION_SYNC_THRESHOLD) {
          if (positionDiff > 0) {
            await song.set("nudge_down", false);
            await song.set("nudge_up", true);
          } else if (positionDiff < 0) {
            await song.set("nudge_up", false);
            await song.set("nudge_down", true);
          }
        }
      }
    } catch (error) {
      console.error("[Slave] Błąd przetwarzania wiadomości UDP:", error);
    }
  });

  socket.on("error", (err) => {
    console.error("[Slave] Błąd UDP socket:", err);
  });

  setInterval(() => {
    const timeSinceLastSync = Date.now() - lastSyncTime;

    if (isConnected && timeSinceLastSync > SYNC_TIMEOUT) {
      console.log("[Slave] Utracono połączenie z masterem");
      isConnected = false;
    }
  }, 1000);

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

runSlave();
