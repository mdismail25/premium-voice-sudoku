# 🧠 Premium Voice Sudoku

An **accessible, voice-first Sudoku game** with a futuristic neon UI, designed so it can be played even by **visually impaired / low-vision users** using speech input and audio output.

Live demo: **https://premium-voice-sudoku-a7br.vercel.app/**

---

## 👤 Developer Information

| Field | Details |
|-------|---------|
| Student Name | **Mohammed Ismail Y** |
| Course | B.Tech – Computer Science Engineering |
| Project Type | Final Year Major Project |
| Role | Full-stack Web Developer & Voice Interaction Engineer |
| Academic Year | 2024–2025 |

---

## ✨ Key Features

- 🎙️ **Full voice control on the Sudoku board**
- 👨‍🦯 **Designed for blind & low-vision users**
- 💡 **AI-style Hint + Solver**
- 🌈 **Neon animated background**
- ✉️ **Voice-enabled feedback form**
- 🌐 **Hosted live on Vercel**

---

## 🗂 Project Structure

```text
root/
├─ index.html
├─ feedback.html
├─ style.css
├─ main.js
├─ voice.js
├─ sudoku.js
├─ solver.worker.js
├─ feedback.js
├─ voice-confirm.js    # optional
└─ animated-bg/
   ├─ final.css
   ├─ final.js
   ├─ combined-bg.js
   ├─ ULTIMATE-bg.js
   └─ ULTIMATE-GOD-BG.js
````

---

## 🚀 Getting Started (Local Development)

### 1️⃣ Clone Project

```bash
git clone <your-repo-url>.git
cd <your-repo-folder>
```

### 2️⃣ Serve Locally

#### Option A — Using `serve`

```bash
npm install -g serve
serve .
```

Then open the localhost URL
(usually `http://localhost:3000`)

#### Option B — VS Code Live Server

* Open project in VS Code
* Install **Live Server** extension
* Right-click `index.html` → **Open with Live Server**

> 💡 Use **Google Chrome (Desktop)** for best SpeechRecognition support.

---

## 🧭 Page Flow

| Page          | File            | Purpose                           |
| ------------- | --------------- | --------------------------------- |
| Sudoku Game   | `index.html`    | Voice-controlled Sudoku gameplay  |
| Feedback Form | `feedback.html` | Voice-enabled feedback submission |

📌 No welcome page — game loads directly.

---

## 🎙️ Voice Command Guide

### ▶ Sudoku Page

| Feature             | Commands                                                     |
| ------------------- | ------------------------------------------------------------ |
| Move                | `up`, `down`, `left`, `right`                                |
| Insert Number       | `one` → `nine` or `1` → `9`                                  |
| Clear Cell          | `clear`, `delete`, `remove`                                  |
| Hint                | `hint`                                                       |
| Solve               | `solve`                                                      |
| New Puzzle          | `reset`, `new game`, `new puzzle`, `start game`              |
| Undo                | `undo`                                                       |
| Go to Feedback Page | `feedback`                                                   |
| Mic Control         | `stop listening`, `stop voice`, `keep quiet`, `stop talking` |

---

### 📝 Feedback Page Commands

| Action        | Commands                          |
| ------------- | --------------------------------- |
| Enter Name    | `name is …`, `enter name …`       |
| Enter Message | `message is …`, `enter message …` |
| Submit        | `submit`, `send feedback`         |
| Clear         | `clear`                           |
| Go Back       | `back`, `go back`, `sudoku`       |

Example usage:

> “Enter name John and message I like your sudoku game”

---

## 🧑‍🦯 Accessibility Features

Designed so blind users can **fully play without vision**:

* Full voice navigation & input
* Spoken response after every action
* Keyboard shortcuts:

  * ⬆⬇⬅➡ → Move cell
  * **1–9** → Insert number
  * **Delete / Backspace** → Clear cell

> Technology should empower **everyone** 💙

---

## 🛠 Tech Stack

| Feature       | Technology                                            |
| ------------- | ----------------------------------------------------- |
| Frontend      | HTML, CSS, JavaScript                                 |
| Speech Input  | `SpeechRecognition` / `webkitSpeechRecognition`       |
| Speech Output | `speechSynthesis`                                     |
| Solver        | Backtracking algorithm in Web Worker                  |
| Visual FX     | Canvas animations (butterflies, particles, fireflies) |
| Hosting       | **Vercel**                                            |

---

## ☁️ Deployment (Vercel)

1️⃣ Push to GitHub
2️⃣ On **Vercel** → *Import project*
3️⃣ Configure:

| Setting          | Value       |
| ---------------- | ----------- |
| Framework        | Other       |
| Build Command    | *(empty)*   |
| Output Directory | `./` (root) |

Then → **Deploy** 🎯

---

## 🔮 Future Enhancements

* Multi-language voice recognition
* Save progress locally or via cloud database
* Full board audio reading: “read row/column/board”
* Leaderboard & scoring
* Backend-stored feedback

---

## 📝 License

```
MIT License
You are free to use, study, modify, and improve this software.
```

---

## ✨ Credits
This project is designed and developed by:

Mohammed Ismail Y
USN: 4VZ23CS401
VTU Mysore — Department of CSE

“Technology should empower everyone — with or without sight.” 🌟

---

```

---

