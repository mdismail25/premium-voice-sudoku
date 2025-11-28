# 🧠 Premium Voice Sudoku

An **accessible, voice-first Sudoku game** with a futuristic neon UI, designed so it can be played even by **visually impaired / low-vision users** using speech input and audio output.

Live demo: **https://premium-voice-sudoku-a7br.vercel.app/**

---

## ✨ Key Features

- 🎙️ **Full voice control on the Sudoku board**
  - Move cells: “up”, “down”, “left”, “right”
  - Enter numbers by speaking: “one” to “nine”
  - Clear cells: “clear / delete / remove”
  - Get help: “hint” or “solve”
  - Undo moves: “undo” (if wired in `main.js` / `voice.js`)
  - Navigate: “feedback” to open the feedback page
  - Turn mic off: “stop listening / stop voice / stop talking”

- 👨‍🦯 **Blind-friendly design**
  - Audio feedback for selected cell and actions (via `announce()` / `speak()` in `sudoku.js`)
  - Designed so a blind user can navigate the grid and play using only voice and keyboard

- 💡 **AI-style helper tools**
  - **Hint** fills exactly one correct cell using the solver in a separate Web Worker
  - **Solve** completes the whole board using a backtracking Sudoku solver

- 🌈 **Neon animated background**
  - Multiple `<canvas>` layers for neon particles, butterflies, fireflies, etc.
  - Futuristic glowing UI that runs behind the Sudoku game

- ✉️ **Feedback page with voice input**
  - User can say: “enter name …” and “message is …”
  - Form can be submitted via “send feedback / submit”
  - After submit, user is redirected back to the Sudoku game

- 🌐 **Deployed on Vercel**
  - Static front-end hosted via Vercel
  - Optimised for **Chrome** desktop (best SpeechRecognition support)

---

## 🗂 Project Structure

> Exact file names may vary a little, but the core idea is:

```text
root/
├─ index.html          # Main Sudoku game page (landing page)
├─ feedback.html       # Feedback form page
├─ style.css           # Global styles (neon theme, grid, buttons, etc.)
├─ main.js             # Game initialization, worker hook, buttons, keyboard
├─ voice.js            # Voice engine for Sudoku page (SpeechRecognition)
├─ sudoku.js           # Sudoku board logic, TTS helpers (speak, announce, etc.)
├─ solver.worker.js    # Web Worker that solves Sudoku in the background
├─ feedback.js         # Feedback page logic + voice control
├─ voice-confirm.js    # Optional voice confirmation helpers (if present)
└─ animated-bg/
   ├─ final.css
   ├─ final.js
   ├─ combined-bg.js
   ├─ ULTIMATE-bg.js
   └─ ULTIMATE-GOD-BG.js

```
```Getting Started (Local Development)

You can run this as a simple static site.

1. Clone or download the project
git clone <your-repo-url>.git
cd <your-repo-folder>


Or just copy all project files into a folder.

2. Serve locally (Option A – serve)
npm install -g serve
serve .


Then open the printed URL in your browser
(usually http://localhost:3000).

3. Serve locally (Option B – VS Code Live Server)

Open the folder in VS Code.

Install the Live Server extension.

Right-click index.html → “Open with Live Server”.

💡 Use Google Chrome on desktop for best SpeechRecognition support.

🧭 Page Flow

index.html – Premium Voice Sudoku (Main Game)

This is now the first page when you open the app.

Shows:

Sudoku 9×9 grid

Buttons: New Game, Solve, Hint, Voice

Feedback button (top-right) to open the feedback page

Voice commands are handled by voice.js.

feedback.html – Feedback Page

Fields: Name, Message

Buttons: Submit, Clear, and ← Sudoku (go back to main game)

Voice-enabled via feedback.js.

There is no separate welcome page anymore; the app goes straight into the Sudoku game.

🎙️ Voice Commands Reference

Exact commands depend on your final voice.js / feedback.js, but this is the intended usage.

On Sudoku Page (index.html)

Movement:

“up”

“down”

“left”

“right”

Numbers:

“one”, “two”, … “nine”

or “1” … “9” spoken as digits

Board actions:

“clear / delete / remove” → clear current cell

“hint” → apply a single-cell hint

“solve” → solve entire puzzle via Web Worker

“reset / new game / new puzzle / start” → generate a new puzzle

“undo” → undo last move (if implemented with an undo stack)

Navigation:

“feedback” → open feedback page

Mic control:

“stop listening”

“stop voice”

“stop talking”

“keep quiet”

On Feedback Page (feedback.html)

Filling fields:

“name is … / my name is … / enter name …”

“message is … / my message is … / enter message …”

Combined example:

“enter name John and message I like your sudoku game”

Actions:

“send feedback / submit feedback / send / submit”

“clear” → reset the form

“back / go back / sudoku” → return to Sudoku main page

Mic control:

“stop listening / stop voice / stop talking / keep quiet”

🧑‍🦯 Accessibility Notes

Designed for visually impaired / low-vision users:

Voice commands to move around the grid and fill numbers.

Spoken feedback when commands are executed.

Keyboard support:

Arrow keys: move selection

1–9: enter numbers

Backspace / Delete: clear cell

🛠 Tech Stack

Frontend: HTML, CSS, JavaScript

Speech Input: window.SpeechRecognition / webkitSpeechRecognition

Text-to-Speech: window.speechSynthesis

Background: <canvas> animations (neon particles, butterflies, fireflies)

Solver: Custom backtracking Sudoku solver running inside a Web Worker

Hosting: Vercel
 static deployment

📦 Deployment (Vercel)

Push your project to a Git repository (GitHub / GitLab / Bitbucket).

In Vercel:

Import the repository.

Framework: "Other" (static).

Build command: (empty) or a simple build script if you add one.

Output directory: project root (where index.html lives).

Deploy – Vercel will serve index.html as the default page.

Current live link:
https://premium-voice-sudoku-a7br.vercel.app/

🔮 Future Enhancements (Ideas)

More detailed blind-user audio (“read row”, “read column”, “read board” fully).

Saving Sudoku progress (localStorage or backend).

Multi-language voice support.

Server-side feedback collection with database.

📝 License

Add your preferred license, for example:

MIT License – feel free to study, modify and improve this project.


Or replace with your college / project-specific license terms.


If you tell me your **GitHub repo name + description** I can tweak the top part (title + one-line description) to match exactly what you’ll submit for college.





