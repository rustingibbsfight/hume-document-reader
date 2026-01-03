# Hume AI Document Reader

A web application that allows users to upload documents or paste text and have them read aloud using Hume AI's expressive Octave TTS (Text-to-Speech) technology.

## Features

- 📄 **Multiple Document Formats**: Upload PDF, DOCX, TXT, MD, or HTML files
- 📝 **Direct Text Input**: Paste any text directly into the app
- 🎙️ **100+ AI Voices**: Choose from Hume AI's extensive voice library
- ⚡ **Instant Streaming**: Ultra-low latency audio generation
- 💫 **Expressive Speech**: AI voices that understand context and emotion
- 🌐 **Web-Based**: Access from any browser, hosted on Vercel

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **TTS API**: Hume AI Octave
- **Document Parsing**: pdf-parse, mammoth
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Hume AI API key (get one at [app.hume.ai](https://app.hume.ai))

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd hume-document-reader
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   HUME_API_KEY=your_hume_api_key_here
   HUME_SECRET_KEY=your_hume_secret_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open** [http://localhost:3000](http://localhost:3000) in your browser

### Deploy to Vercel

#### Option 1: Deploy with Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Follow the prompts and add your environment variables when asked.

#### Option 2: Deploy via GitHub

1. Push your code to GitHub

2. Go to [vercel.com](https://vercel.com) and import your repository

3. Add environment variables in the Vercel dashboard:
   - `HUME_API_KEY`: Your Hume AI API key
   - `HUME_SECRET_KEY`: Your Hume AI secret key

4. Deploy!

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `HUME_API_KEY` | Your Hume AI API key | Yes |
| `HUME_SECRET_KEY` | Your Hume AI secret key | No (but recommended) |

## Usage

1. **Add Content**: Upload a document (PDF, DOCX, TXT, MD, HTML) or paste text directly
2. **Choose a Voice**: Browse and select from 100+ expressive AI voices
3. **Listen**: Press play to hear your content read aloud with natural emotion

## API Routes

- `POST /api/tts` - Generate speech from text
- `GET /api/voices` - List available voices
- `POST /api/parse` - Parse uploaded documents

## Supported File Types

- `.txt` - Plain text
- `.md` - Markdown
- `.pdf` - PDF documents
- `.docx` - Microsoft Word documents
- `.html` / `.htm` - HTML files

## Acknowledgments

- [Hume AI](https://hume.ai) for the amazing Octave TTS API
- [Next.js](https://nextjs.org) for the React framework
- [Vercel](https://vercel.com) for hosting

## License

MIT License - feel free to use this for your own projects!

---

Made with ❤️ using [Hume AI](https://hume.ai)
