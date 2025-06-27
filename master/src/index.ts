import { Ableton } from "ableton-js";
import WebSocket, { WebSocketServer } from "ws";

const PORT = 8080;

interface TransportMessage {
  isPlaying: boolean;
  position: number;
  tempo: number;
}

async function runMaster() {
  const ableton = new Ableton({ logger: console });
  await ableton.start();
  const song = ableton.song;

  const wss = new WebSocketServer({ port: PORT });
  console.log(`[Master] Serwer WebSocket uruchomiony na porcie ${PORT}`);

  const clients: WebSocket[] = [];
  wss.on("connection", (ws) => {
    clients.push(ws);
    ws.on("close", () => {
      const index = clients.indexOf(ws);
      if (index !== -1) clients.splice(index, 1);
    });
  });

  let prevData: TransportMessage | null = null;
  const broadcast = (data: TransportMessage) => {
    if (
      prevData &&
      prevData.isPlaying === data.isPlaying &&
      prevData.position === data.position &&
      prevData.tempo === data.tempo
    ) {
      return;
    }
    prevData = data;
    const payload = JSON.stringify(data);
    console.log("[BROADCAST] Wysylam wiadomosc do klienta", payload);
    clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  };

  song.addListener("is_playing", async (isPlaying: boolean) => {
    const position = await song.get("current_song_time");
    const tempo = await song.get("tempo");
    const message: TransportMessage = { isPlaying, position, tempo };
    console.log(
      `[Master] Stan "is_playing" sie zmienil: ${JSON.stringify(message)}`
    );
    broadcast(message);
  });

  setInterval(async () => {
    const isPlaying = await song.get("is_playing");
    const position = await song.get("current_song_time");
    const tempo = await song.get("tempo");
    const message: TransportMessage = { isPlaying, position, tempo };
    broadcast(message);
  }, 1000);
}

runMaster().catch(console.error);
