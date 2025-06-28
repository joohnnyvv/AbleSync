import { Ableton } from "ableton-js";
import WebSocket from "ws";

const MASTER_IP = process.env.MASTER_WS_IP;
if (!MASTER_IP) {
  console.error("Brakuje zmiennej środowiskowej MASTER_WS_IP");
  process.exit(1);
}

const MASTER_WS_URL = `ws://${MASTER_IP}:8080`;

interface TransportMessage {
  isPlaying: boolean;
  position: number;
  tempo: number;
}

async function connectToMaster() {
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 3000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const ws = new WebSocket(MASTER_WS_URL);

      await new Promise((resolve, reject) => {
        ws.on("open", resolve);
        ws.on("error", reject);

        setTimeout(() => {
          reject(new Error("Connection timeout"));
        }, 5000);
      });

      console.log(`[Slave] Połączono z masterem (${MASTER_WS_URL})`);
      return ws;
    } catch (err: any) {
      console.error(
        `[Slave] Błąd połączenia (próba ${attempt}/${MAX_RETRIES}):`,
        err.message
      );
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }

  throw new Error(
    `Nie udało się połączyć z masterem po ${MAX_RETRIES} próbach`
  );
}

async function runSlave() {
  const ableton = new Ableton({ logger: console });
  await ableton.start();
  const song = ableton.song;

  const ws = await connectToMaster();

  ws.on("open", () => {
    console.log(`[Slave] Polaczono z serwerem ${MASTER_WS_URL}`);
  });

  ws.on("message", async (data) => {
    const msg: TransportMessage = JSON.parse(data.toString());
    const currentPosition = await song.get("current_song_time");
    const isPlaying = await song.get("is_playing");

    const positionDiff = Math.abs(currentPosition - msg.position);
    const shouldUpdatePosition = positionDiff > 0.2;

    console.log(
      `[Slave] Otrzymano: playing=${msg.isPlaying}, position=${msg.position}, tempo=${msg.tempo}`
    );
    console.log(
      `[Slave] Aktualna pozycja: ${currentPosition}, różnica: ${positionDiff}`
    );

    if (shouldUpdatePosition) {
      await song.set("current_song_time", msg.position);
      console.log(`[Slave] Ustawiono pozycję na ${msg.position}`);
    }

    if (msg.isPlaying) {
      if (!isPlaying) {
        await song.set("is_playing", true);
        console.log(`[Slave] Włączono odtwarzanie`);
      }
    } else {
      if (isPlaying) {
        await song.set("is_playing", false);
        console.log(`[Slave] Zatrzymano odtwarzanie`);
      }
    }

    await song.set("tempo", msg.tempo);
    console.log(`[Slave] Dostosowano tempo ${msg.tempo}`);
  });
}

runSlave().catch(console.error);
