import { Ableton } from "ableton-js";
import WebSocket from "ws";
import { config } from "dotenv";
config();

const MASTER_IP = process.env.MASTER_WS_IP;
if (!MASTER_IP) {
  throw new Error("Brakuje zmiennej środowiskowej MASTER_WS_IP");
}

const MASTER_WS_URL = `ws://${MASTER_IP}:8080`;

interface TransportMessage {
  isPlaying: boolean;
  position: number;
  tempo: number;
}

async function runSlave() {
  const ableton = new Ableton({ logger: console });
  await ableton.start();
  const song = ableton.song;

  const ws = new WebSocket(MASTER_WS_URL);

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
