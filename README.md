# AI Bookmark Manager

An AI-powered bookmark management tool that helps you organize, analyze, and clean up your browser bookmarks using Google Gemini.

<div align="center">

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/muscl3n3rd)

</div>

## Features

- **Import Bookmarks**: Upload your browser's exported bookmark HTML file
- **Duplicate Detection**: Find and manage duplicate bookmarks across your collection
- **Empty Folder Cleanup**: Identify and remove empty folders
- **Health Audit**: Analyze bookmark health with AI-powered insights
- **AI Insights**: Get intelligent recommendations for organizing your bookmarks
- **Fix It All**: One-click AI-powered reorganization of your entire bookmark collection
- **Search & Filter**: Quickly find bookmarks across your collection
- **Export**: Download your organized bookmarks as an HTML file

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- A [Google Gemini API Key](https://makersuite.google.com/app/apikey)

## Local Deployment

### Using Docker Compose (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai-bookmark-manager
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

3. **Build and run**
   ```bash
   docker compose up -d --build
   ```

4. **Access the application**

   Open your browser and navigate to:
   ```
   http://localhost:7847
   ```

5. **View logs (optional)**
   ```bash
   docker compose logs -f
   ```

6. **Stop the application**
   ```bash
   docker compose down
   ```

### Development Mode (Without Docker)

If you prefer to run without Docker for development:

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and add your Gemini API key.

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Access the application**
   ```
   http://localhost:3000
   ```

## Usage

1. **Export your bookmarks** from your browser (Chrome, Firefox, Edge, etc.) as an HTML file
2. **Upload the file** using the file uploader on the welcome screen
3. **Explore your bookmarks** using the sidebar tree view
4. **Use the toolbar** to access features:
   - **Duplicates**: Find and remove duplicate bookmarks
   - **Empty Folders**: Clean up empty folders
   - **Health Audit**: Run an AI-powered health check
   - **Insights**: Get AI recommendations for organization
   - **Fix It All**: Let AI reorganize your entire collection
5. **Export** your cleaned-up bookmarks back to an HTML file

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite
- **AI**: Google Gemini API
- **Styling**: Tailwind CSS
- **Production Server**: Nginx
- **Containerization**: Docker

## Project Structure

```
ai-bookmark-manager/
├── components/          # React components
├── services/            # API services (Gemini, link checker, exporter)
├── utils/               # Utility functions
├── App.tsx              # Main application component
├── AppContext.tsx       # Global state management
├── types.ts             # TypeScript type definitions
├── Dockerfile           # Multi-stage Docker build
├── docker-compose.yml   # Docker Compose configuration
├── nginx.conf           # Nginx configuration for production
└── vite.config.ts       # Vite configuration
```

## License

MIT
