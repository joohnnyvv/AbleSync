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

    await song.set("is_playing", true);
    console.log(`[Slave] Aktualizacja stanu odtwarzania na ${msg.isPlaying}`);

    await song.set("current_song_time", msg.position);
    console.log(`[Slave] Dostosowano pozycje ${msg.position}`);
    await song.set("tempo", msg.tempo);
    console.log(`[Slave] Adjusted tempo to ${msg.tempo}`);
  });
}

runSlave().catch(console.error);
