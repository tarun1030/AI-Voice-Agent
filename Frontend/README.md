# Voice AI Assistant Frontend

A modern, real-time voice-based AI assistant application built with **Next.js 16**, **React 19**, and **TypeScript**. This frontend enables seamless voice conversations with an AI agent, document uploads, and live call management.

## 🎯 Features

### Core Functionality
- 🎤 **Real-time Voice Support** - Speech recognition and text-to-speech integration
- 💬 **Live Chat Interface** - Full conversation history with markdown support
- 📎 **Document Upload & Retrieval** - Upload documents and retrieve relevant chunks for context
- ☎️ **Live Call Management** - Connect, manage, and end calls with real-time status updates
- 🎨 **Theme Support** - Dark/light mode with Tailwind CSS and Next Themes
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile devices

### Advanced Features
- Speech-to-text using Web Speech API / Deepgram
- Text-to-speech with word-level highlighting during playback
- Real-time voice activity detection and silence timeout handling
- Markdown rendering with syntax highlighting
- Conversation state management with message history
- Audio waveform visualization for listening/speaking states
- Settings and configuration panel for API keys

## 🛠️ Tech Stack

### Frontend Framework
- **Next.js 16** - React framework with app directory routing
- **React 19** - Latest React version with improved hooks and features
- **TypeScript** - Type-safe development

### Styling & UI
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Unstyled, accessible component library
- **Lucide React** - Beautiful SVG icons
- **Next Themes** - Dark mode support with system preference detection

### State & Forms
- **React Hook Form** - Efficient form state management
- **Sonner** - Toast notifications

### Rich Content
- **React Markdown** - Markdown rendering with remark-gfm support
- **Recharts** - Data visualization charts

### Other Utilities
- **cmdk** - Fast, unstyled command palette
- **date-fns** - Date manipulation and formatting
- **clsx/tailwind-merge** - Conditional CSS class utilities

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm/pnpm package manager

### Setup

```bash
# Install dependencies
npm install
# or
pnpm install

# Create environment variables file
cp .env.example .env.local
```

### Environment Variables

Create a `.env.local` file in the root directory with:

```env
# AI & API Services
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_DEEPGRAM_API_KEY=your_deepgram_api_key_here

# LiveKit Configuration
NEXT_PUBLIC_LIVEKIT_URL=your_livekit_url_here
NEXT_PUBLIC_LIVEKIT_API_KEY=your_livekit_api_key_here
NEXT_PUBLIC_LIVEKIT_API_SECRET=your_livekit_api_secret_here

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 🚀 Getting Started

### Development Server

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm run start
```

### Linting

```bash
npm run lint
```

## 📁 Project Structure

```
├── app/                          # Next.js app directory
│   ├── page.tsx                 # Home page (main component)
│   ├── layout.tsx               # Root layout wrapper
│   └── globals.css              # Global styles
│
├── components/                   # React components
│   ├── ui/                      # Radix UI component library
│   ├── header.tsx               # Top navigation header
│   ├── voice-control-card.tsx   # Voice activation controls
│   ├── agent-config-card.tsx    # Agent configuration
│   ├── document-upload-card.tsx # Document upload interface
│   ├── conversation-history.tsx # Chat display & live call overlay
│   ├── settings-modal.tsx       # API keys & settings
│   ├── connection-status.tsx    # Connection indicator
│   └── theme-provider.tsx       # Theme context setup
│
├── hooks/                        # React custom hooks
│   ├── useSpeechRecognition.ts  # Speech-to-text logic
│   ├── useTextToSpeech.ts       # Text-to-speech logic
│   ├── use-toast.ts             # Toast notifications
│   └── use-mobile.tsx           # Mobile detection
│
├── lib/                          # Utilities & helpers
│   ├── api.ts                   # API client & request handlers
│   ├── utils.ts                 # General utilities
│   └── markdown-stripper.ts     # Remove markdown formatting
│
├── styles/                       # Global CSS
│   └── globals.css              # Tailwind directives & custom styles
│
├── components.json              # shadcn/ui configuration
├── tsconfig.json                # TypeScript config
├── tailwind.config.ts           # Tailwind CSS configuration
├── next.config.mjs              # Next.js configuration
└── postcss.config.mjs           # PostCSS configuration
```

## 🔧 Component Breakdown

### Main Components

| Component | Purpose |
|-----------|---------|
| **page.tsx** | Main application logic, state management, API integration |
| **conversation-history.tsx** | Chat display, message rendering, live call overlay with voice waveform |
| **voice-control-card.tsx** | Start/stop recording, voice mode activation |
| **agent-config-card.tsx** | Configure AI agent settings and system prompt |
| **document-upload-card.tsx** | Upload documents, manage document list |
| **settings-modal.tsx** | API key configuration and settings |
| **header.tsx** | Top navigation, theme toggle, menu |

### Custom Hooks

| Hook | Purpose |
|------|---------|
| **useSpeechRecognition** | Manage speech-to-text recognition and transcript updates |
| **useTextToSpeech** | Handle text-to-speech with word-level tracking |
| **use-toast** | Display toast notifications |
| **use-mobile** | Detect mobile viewport for responsive layouts |

## 💬 API Integration

The frontend communicates with a backend API for:
- Message processing and AI responses
- Document upload and chunk retrieval
- Call management and real-time updates

Key API endpoints are configured in `lib/api.ts`.

## 🎨 Customization

### Theming
- Light/dark mode toggle in header
- Colors defined in `tailwind.config.ts` and `globals.css`
- Theme persisted to localStorage via `next-themes`

### Styling
- Global styles in `styles/globals.css`
- Component-scoped Tailwind classes
- Consistent scrollbar styling across all scrollable elements
- CSS variables for theme colors (light/dark mode)

## 👛 UI Component Library

Uses a customized shadcn/ui component library with:
- Pre-built accessible components (Button, Dialog, Input, etc.)
- Consistent styling aligned with the application theme
- Fully customizable with Tailwind CSS

## 🔐 Security

- API keys stored in `.env.local` (never committed to version control)
- Environment variables prefixed with `NEXT_PUBLIC_` are exposed to the browser
- Sensitive keys should be passed server-side only

## 📱 Browser Support

- Chrome/Edge (latest)
- Safari 14+
- Firefox (latest)
- Requires Web Audio API support for speech features

## 🔄 State Management

- **React Hooks** for component-level state (useState, useCallback, useRef)
- **Context** for theme management (next-themes)
- **Local Storage** for theme preference persistence

## 🚀 Performance Optimizations

- Next.js 16 with Turbopack for fast dev builds
- Image optimization with Next.js Image component
- Code splitting and lazy loading
- Efficient re-renders with proper dependency arrays
- Memoization for expensive computations

## 📝 Tips for Development

### Adding New Components
1. Create component file in `components/`
2. Use TypeScript interfaces for props
3. Follow existing styling patterns with Tailwind CSS
4. Export from component directory index if reusable

### API Communication
- Use the `api` client from `lib/api.ts`
- Handle loading and error states
- Provide user feedback via toast notifications

### Debugging
- React DevTools browser extension recommended
- Check browser console for WebSocket/API errors
- Verify environment variables in `.env.local`

## 🤝 Contributing

1. Follow the existing code structure and naming conventions
2. Use TypeScript for type safety
3. Test responsive design on mobile viewports
4. Ensure accessibility with keyboard navigation

## 📄 License

This project is private. All rights reserved.

## 📞 Support

For issues, check:
- Console errors in browser DevTools
- Network tab for API requests
- Environment variables configuration
- Backend API availability

## 🎯 Future Enhancements

- [ ] Multi-language support
- [ ] Advanced search in chat history
- [ ] User authentication system
- [ ] Conversation export (PDF/JSON)
- [ ] Voice profiles and preferences
- [ ] Integration with more AI providers
