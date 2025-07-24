# AbleSync

**⚠️ Alpha Version - Not Stable**

AbleSync is an Electron application that synchronizes transport information (play/stop, position, tempo) between multiple Ableton Live instances over UDP multicast. Perfect for live performances, collaboration, or multi-room setups where you need perfectly synchronized playback.

## 🚀 Features

- **Real-time synchronization** of Ableton Live transport between multiple computers
- **UDP Multicast** communication (no IP configuration required)
- **Master/Slave architecture** - one master controls multiple slaves
- **Adjustable sync threshold** for fine-tuning synchronization precision
- **System tray integration** appears in system tray on MacOS
- **Live connection monitoring** with visual status indicators
- **Comprehensive logging** with save/export functionality

## 📋 Requirements

- **macOS** (currently Mac-only, other platforms planned)
- **Ableton Live**
- **Network connection** between devices (same network/subnet for multicast)
- **Remote Scripts** added and configured as described in ableton-js [README](https://github.com/leolabs/ableton-js/tree/master?tab=readme-ov-file#prerequisites). AbletonJS directory is available in this repository

## 📥 Installation

### Download
1. Go to the [Releases](https://github.com/joohnnyvv/AbleSync/releases) page
2. Download the latest `.dmg` file for macOS
3. Open the `.dmg` and drag AbleSync to your Applications folder

### From Source
```bash
git clone https://github.com/your-username/ablesync.git
cd ablesync
npm install
npm run build
```

## 🎯 Usage

### Quick Start
1. **Connect the computers** into a single network (preferably via a direct LAN cable connection)
2. **Launch AbleSync** on all computers you want to sync
3. **Start Ableton Live** on each computer
4. **On the master computer**: Click "Uruchom jako master" (Run as Master)
5. **On slave computers**: Click "Uruchom jako slave" (Run as Slave)
6. **Start playback** on the master - slaves will automatically follow

### Master Mode
The master computer controls transport for all connected slaves:
- Controls play/stop for entire network
- Broadcasts tempo changes
- Sends position updates for synchronization

### Slave Mode
Slave computers follow the master's transport:
- Automatically start/stop with master
- Sync to master's tempo
- Maintain precise position synchronization
- **Adjustable sync threshold**

### Network Configuration
- Uses **UDP Multicast** on `224.0.1.100:8080`
- **No manual IP configuration** required
- All devices must be on the same network/subnet
- Firewall may need to allow UDP traffic on port 8080

## 🔧 Configuration

### Sync Threshold (Slave Mode)
The sync threshold determines how precise the position synchronization should be:
- **Lower values** (0.001-0.005): Tighter sync, more CPU usage
- **Higher values** (0.01-0.1): Looser sync, less CPU usage
- **Default**: 0.01
- Adjustable in real-time through the UI when running as slave

## 🐛 Troubleshooting

### Connection Issues
- Ensure all devices are on the same network
- Check firewall settings for UDP port 8080
- Verify Ableton Live is running

### Sync Problems
- Adjust sync threshold if experiencing drift
- Check network latency between devices
- Ensure stable network connection
- Monitor logs for error messages

### Performance
- Lower sync threshold = more network traffic
- Multiple slaves increase master's CPU usage
- Close unnecessary applications for better performance

## 📊 Status Indicators

- 🔴 **Red**: Disconnected (no Ableton Live or network connection)
- 🟡 **Yellow**: Partially connected (either Ableton OR network, not both)
- 🟢 **Green**: Fully connected (both Ableton Live and network active)

## 🗂️ Logs

- **Real-time logging** in the main window
- **Export logs** to text files for debugging
- **Clear logs** to reduce memory usage
- Automatic log rotation (keeps last 50 lines)

## 🚧 Current Limitations

- Releases **macOS only**
- **Polish UI** (English localization planned)
- **Alpha stability** (expect bugs and crashes)
- **Manual deployment** (no auto-updater yet)
- **Basic error handling** (more robust error recovery planned)

## 🔮 Planned Features

- [ ] English language support
- [ ] Auto-updater integration
- [ ] Advanced sync options

## 🤝 Contributing

This project is in alpha stage. If you encounter bugs or have feature requests:

1. Check existing [Issues](https://github.com/joohnnyvv/AbleSync/issues)
2. Create a new issue with detailed description
3. Include logs and system information
4. PRs welcome for bug fixes and improvements

## 📄 License

MIT License

Copyright (c) 2025 Jan Rembikowski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## ⚠️ Disclaimer

This is alpha software. Use at your own risk.

---
