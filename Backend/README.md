# Voice AI Backend

Real-time voice AI orchestration backend with LiveKit, RAG, and Gemini Flash 2.5.

## Features

- **Voice Pipeline**: STT → LLM (with RAG) → TTS
- **Knowledge Base**: FAISS vector store with all-MiniLM-L6-v2 embeddings
- **Document Support**: PDF, DOCX, TXT
- **LLM**: Google Gemini Flash 2.5
- **WebRTC**: LiveKit integration

## Prerequisites

- Python 3.11+
- Docker & Docker Compose
- LiveKit server (local or cloud)
- API Keys:
  - Google Gemini API key
  - LiveKit API credentials
  - Deepgram API key

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
GEMINI_API_KEY=your_gemini_api_key
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
DEEPGRAM_API_KEY=your_deepgram_api_key
```

### 2. Docker Deployment (Recommended)

```bash
# Build and start all services
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Backend will be available at `http://localhost:8000`

### 3. Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## LiveKit Setup

### Option 1: Local LiveKit Server

```bash
# Download and run LiveKit server
docker run --rm -p 7880:7880 \
  -p 7881:7881 \
  -p 7882:7882/udp \
  -v $PWD/livekit.yaml:/livekit.yaml \
  livekit/livekit-server \
  --config /livekit.yaml
```

### Option 2: LiveKit Cloud

1. Sign up at https://livekit.io
2. Get your API key and secret
3. Update `LIVEKIT_URL` to your cloud instance URL

## API Endpoints

### Health Check
```
GET /health
```

### Documents
```
POST /api/documents/upload
GET /api/documents
DELETE /api/documents/{doc_id}
```

### Agent
```
POST /api/agent/prompt
GET /api/agent/prompt
POST /api/agent/start
POST /api/agent/stop
```

### LiveKit
```
POST /api/livekit/token
```

## Usage

### 1. Upload Documents

```bash
curl -X POST "http://localhost:8000/api/documents/upload" \
  -F "file=@document.pdf"
```

### 2. Update System Prompt

```bash
curl -X POST "http://localhost:8000/api/agent/prompt" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "You are a helpful assistant specializing in..."}'
```

### 3. Create LiveKit Token

```bash
curl -X POST "http://localhost:8000/api/livekit/token" \
  -F "room_name=my-room" \
  -F "participant_name=user1"
```

### 4. Start Agent

```bash
curl -X POST "http://localhost:8000/api/agent/start" \
  -H "Content-Type: application/json" \
  -d '{"room_name": "my-room"}'
```

## Architecture

```
User Audio (WebRTC/LiveKit)
    ↓
STT Service (Deepgram)
    ↓
LLM Service (Gemini Flash 2.5) ← RAG Context (FAISS + all-MiniLM)
    ↓
TTS Service (Google TTS)
    ↓
User Audio (WebRTC/LiveKit)
```

## File Structure

```
voice-ai-backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application
│   ├── config.py               # Configuration
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py          # Pydantic models
│   └── services/
│       ├── __init__.py
│       ├── knowledge_base.py   # FAISS + embeddings
│       ├── llm_service.py      # Gemini integration
│       ├── stt_service.py      # Speech-to-text
│       ├── tts_service.py      # Text-to-speech
│       ├── livekit_service.py  # LiveKit management
│       └── voice_agent.py      # Pipeline orchestration
├── data/                       # Vector store & metadata
├── uploads/                    # Uploaded documents
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## Known Limitations

1. **STT/TTS Placeholders**: Current implementation has placeholder methods for Deepgram STT and Google TTS. Full integration requires:
   - Deepgram WebSocket streaming setup
   - Google Cloud TTS API setup

2. **LiveKit Agent**: Agent orchestration is simplified. Full LiveKit Agents SDK integration needed for production.

3. **Error Handling**: Basic error handling implemented. Production needs:
   - Retry logic
   - Circuit breakers
   - Better error recovery

4. **Scaling**: Single instance design. For production:
   - Add Redis for shared state
   - Implement agent pooling
   - Add load balancing

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9
```

### FAISS Not Loading
```bash
# Clear data directory
rm -rf data/*
# Restart the service
```

### Docker Permission Issues
```bash
# Fix volume permissions
sudo chown -R $USER:$USER data uploads
```

## Development

### Run Tests
```bash
pytest tests/
```

### Format Code
```bash
black app/
isort app/
```

### Type Checking
```bash
mypy app/
```

## License

MIT
