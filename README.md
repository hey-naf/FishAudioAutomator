# Fish Audio Automator (v2.2.3)

Fish Audio Automator is a high-performance Google Chrome Side Panel extension designed to automate text-to-speech (TTS) voice generation and batch downloads directly on the [fish.audio](https://fish.audio) web app.

It splits large scripts into optimized, customizable character limits, updates the web page editor, triggers rendering, and automatically downloads the resulting files with structured indexes (e.g. `Prefix_Part_001.mp3`).

---

## ✨ Key Features

- **Side Panel Interface**: Integrated into the Chrome Side Panel (`sidePanel` API) for seamless multitasking alongside the webpage.
- **Bulk Script File Uploads**: Directly upload text scripts (`.txt`, `.md`, and `.docx` Word Documents) to automate complete audiobooks or long narrations.
- **Smart Text Splitting**: Automatically divides input scripts by character limit, prioritizing paragraphs and sentences to prevent voice rendering breaks.
- **Apple-Style resizable UI**: Sleek dark mode design with vertically resizable textarea and scroll previews.
- **Automatic Sequence Renaming**: Intercepts browser download events using background service workers to save files cleanly with custom prefixes and padded counts (e.g. `Audiobook_Part_001.mp3`).
- **Interactive Chunk List**: Drag-to-resize preview drawer, individual deletion toggles, and live progress indicators (grey dot = pending, pulsing blue dot = rendering, green dot = completed).
- **Background Automation Tracking**: Runs automation smoothly in the background even if you switch browser tabs, showing connection status alerts (`Connected (BG)`).
- **Programmatic Credit Monitoring**: Automatically checks and displays your remaining voice credits directly inside the Side Panel, with auto-click syncing and warning thresholds for insufficient balance.

---

## 🚀 Installation Guide

Since this is a custom extension, install it unpacked in developer mode:

1. Download or clone this repository to your computer.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** in the top left.
5. Select the `Fish Audio Automator` folder containing `manifest.json`.

---

## 📖 How to Use

1. Navigate to [fish.audio/go](https://fish.audio) and choose your voice model.
2. Click the extension icon in your Chrome toolbar to open the **Fish Audio Automator** Side Panel.
3. Choose your input tab:
   - **📝 Text Input**: Type or paste raw scripts directly into the box.
   - **📁 File Upload**: Drag and drop a text, markdown, or Word document.
4. Customize parameters in the settings drawer:
   - **Split Mode**: Smart Splitting (by sentences) or Hard Limit (exact boundary).
   - **Chunk Limit**: Set target characters per chunk (e.g., 500 chars).
   - **Rename Prefix**: Set the naming pattern.
5. Click **Start Automation** and let the extension generate and download your batch files!

---

## 🛠️ Tech Stack

- **Extension Framework**: manifest v3 (Chrome Extensions)
- **Frontend Logic**: Vanilla JS, HTML5, Custom CSS3 Variables (Dark Mode)
- **Background Tasks**: Chrome Background Service Worker (`background.js`)
- **Document Parsers**: Integrated [Mammoth.js](https://github.com/mwilliamson/mammoth.js) for Word `.docx` binary extraction.
- **State Management**: Local Chrome Storage Sync (`chrome.storage.local`).

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](file:///G:/EXTENSIONS/Fish%20Audio%20Automator/LICENSE) file for details.
