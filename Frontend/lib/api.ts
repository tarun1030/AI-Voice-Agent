const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = {
  // Document operations
  uploadDocument: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_URL}/api/documents/upload`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },

  getDocuments: async () => {
    const res = await fetch(`${API_URL}/api/documents`);
    return res.json();
  },

  deleteDocument: async (docId: string) => {
    const res = await fetch(`${API_URL}/api/documents/${docId}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  // Prompt operations
  getPrompt: async () => {
    const res = await fetch(`${API_URL}/api/agent/prompt`);
    return res.json();
  },

  updatePrompt: async (prompt: string) => {
    const res = await fetch(`${API_URL}/api/agent/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    return res.json();
  },

  // LiveKit operations
  createToken: async (roomName: string, participantName: string) => {
    const formData = new FormData();
    formData.append('room_name', roomName);
    formData.append('participant_name', participantName);
    const res = await fetch(`${API_URL}/api/livekit/token`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },

  // Agent operations
  startAgent: async (roomName: string) => {
    const res = await fetch(`${API_URL}/api/agent/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_name: roomName }),
    });
    return res.json();
  },

  stopAgent: async (roomName: string) => {
    const formData = new FormData();
    formData.append('room_name', roomName);
    const res = await fetch(`${API_URL}/api/agent/stop`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },

  // Query with RAG
  queryAgent: async (query: string, roomName: string) => {
    const res = await fetch(`${API_URL}/api/agent/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, room_name: roomName }),
    });
    return res.json();
  },
};
