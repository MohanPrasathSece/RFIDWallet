# Smart RFID Approval System (MERN + Socket.IO + Flask)

Monorepo with three parts:
- `server/` Node.js + Express + MongoDB + Socket.IO
- `client/` React + Vite + Tailwind
- `ai-service/` Python Flask recommendation stub

## Quick Start

1) Copy `server/.env.example` to `server/.env` and set values.

2) Install dependencies:
- Server (Node 18+):
```
npm i --prefix server
```
- Client:
```
npm i --prefix client
```
- AI service (Python 3.10+ recommended):
```
python -m venv venv && venv\\Scripts\\activate && pip install -r ai-service/requirements.txt
```

3) Run services:
- Server:
```
npm run dev --prefix server
```
- Client:
```
npm run dev --prefix client
```
- AI service:
```
python ai-service/app.py
```

Then open http://localhost:5173

## Notes
- Auth endpoints: `POST /api/auth/signup`, `POST /api/auth/login`
- Health check: `GET /api/health` (server) and `GET /health` (AI service)
- Next steps: implement module routes for Library, Food, Store, Admin; Socket events for approval logs; offline Bluetooth mode.
