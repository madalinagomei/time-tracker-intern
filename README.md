# Timeline Planner – Interactive Resource Planning Tool

A high-performance, timeline-based planning tool inspired by products like Linear, Notion, and Toggl Plan — built from scratch with a strong focus on UX, speed, and real-world usability.

---

## ✨ Features

### 🧠 Smart Timeline
- View projects across multiple users in a clean horizontal timeline
- Zoom levels: **5 weeks / 3 months / 6 months**
- Viewport-aware scaling (no broken layouts on large screens)
- Infinite scroll with automatic range shifting

### 🎯 Powerful Interactions
- Drag & drop to move assignments between users
- Resize assignments with precise control
- **Alt / Ctrl + Drag** → duplicate assignment
- **Shift + Drag** → lock movement to the same user (horizontal only)
- Ghost previews for smooth visual feedback

### ⚡ Fast Inline Creation
- Click anywhere → instantly create assignment
- Type to:
  - reuse existing project
  - or create a new one on the fly
- Smart suggestions + recent projects

### 🧩 Clean UX Details
- Compact labels (HOL, SICK, etc.) for short items
- Tooltip with full info (project, user, dates)
- Overflow menu (`...`) for small items → Open / Duplicate / Delete
- Keyboard shortcuts:
  - `Delete` → remove assignment
  - `Escape` → cancel interactions / clear selection

### 🎛️ Manual Row Resizing (Figma-style)
- Resize space between users via drag handles
- Assignments stay fixed (no distortion)
- Extra space is created dynamically
- Auto-scroll when dragging near edges

### 🌙 Proper Theming
- Fully consistent **Dark / Light mode**
- No mixed surfaces or broken contrast
- Clean grid, subtle weekends, readable hierarchy

---

## 🧱 Tech Stack

- **React + TypeScript**
- **Vite**
- **Tailwind CSS**
- No heavy UI libraries – everything is custom-built

---

## ⚙️ Architecture Highlights

- Virtualized row rendering for performance
- Separation between:
  - layout (row height, lanes)
  - data (assignments)
  - interaction state (drag, resize, duplicate)
- Preview → commit pipeline for all interactions
- Fully frontend-driven (no backend dependency required)

---

## 🚀 Getting Started

```bash
npm install
npm run dev
