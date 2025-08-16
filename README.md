# AutoModel - AI Image Generation Interface

A powerful React-based image generation application that integrates with Leonardo.ai's API to create stunning images and videos using various AI models. This app provides an intuitive interface for selecting models, configuring settings, and generating media with advanced prompt enhancement capabilities.

## Features

### 🎨 Multiple AI Models
- **FLUX Models**: FLUX.1 Kontext Pro, Flux Dev, Flux Schnell
- **Leonardo Phoenix**: Phoenix 1.0 & 0.9 with Alchemy support
- **Leonardo XL Series**: Lightning XL, Anime XL, Diffusion XL, Kino XL, Vision XL
- **Custom Models**: Lucid Origin, Lucid Realism, SDXL 1.0, AlbedoBase XL
- **Video Models**: MOTION2, VEO3
- **Auto Mode**: Intelligent model selection based on prompt analysis

### ⚙️ Advanced Settings
- **Style Presets**: 25+ artistic styles (Cinematic, Anime, Photography, etc.)
- **Aspect Ratios**: Multiple ratios (1:1, 16:9, 9:16, 4:3, 3:4)
- **Batch Generation**: Generate 1-8 images simultaneously
- **Contrast Control**: Fine-tune contrast for supported models
- **Seed Control**: Reproducible results with custom seeds

### 🤖 AI-Powered Features
- **Prompt Enhancement**: Gemini AI integration for intelligent prompt optimization
- **Auto Model Selection**: Automatic model recommendation based on prompt content
- **Real-time Generation**: Live progress tracking with status indicators
- **Generation History**: Track and view all generated images with metadata

### 🔧 Technical Features
- **React 19** with TypeScript
- **Vite** for fast development and building
- **Leonardo.ai API** integration
- **Google Gemini API** for prompt enhancement
- Responsive design with mobile support
- Local storage for API keys and settings

## Prerequisites

- Node.js (version 16 or higher)
- Leonardo.ai API key
- Google Gemini API key (optional, for prompt enhancement)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd auto-model
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up API keys**
   
   **Option A: Settings Modal (Recommended)**
   - Run the app and click "API Settings"
   - Enter your Leonardo.ai API key
   - Optionally enter your Google Gemini API key for prompt enhancement
   
   **Option B: Secrets File**
   - Create a `secrets.md` file in the public directory:
   ```
   Leo Key:
   your_leonardo_api_key_here
   
   Gemini Key:
   your_gemini_api_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

## API Keys Setup

### Leonardo.ai API Key
1. Visit [Leonardo.ai](https://leonardo.ai)
2. Sign up/login to your account
3. Navigate to API settings
4. Generate an API key
5. Add it to the app via Settings modal or secrets.md file

### Google Gemini API Key (Optional)
1. Visit [Google AI Studio](https://makersuite.google.com)
2. Create a new API key
3. Add it to the app for prompt enhancement features

## Usage

### Basic Image Generation
1. Enter a descriptive prompt in the text area
2. Select your preferred model (or use "Auto" for intelligent selection)
3. Configure settings (style, aspect ratio, number of images)
4. Click "Generate" or press Enter

### Advanced Features
- **Auto Mode**: Automatically selects the best model and enhances prompts
- **Manual Enhancement**: Enable "AI Prompt Enhancement" for any model
- **Batch Generation**: Adjust the slider to generate multiple images
- **Style Control**: Choose from 25+ artistic styles
- **Reproducible Results**: Set a seed value for consistent outputs

### Generation History
- View all generated images in the main panel
- See original and enhanced prompts
- Track model usage and settings
- Click images to view in full size

## Project Structure

```
auto-model/
├── components/          # React components
│   ├── ImageViewer.tsx  # Image display and lightbox
│   ├── SettingsModal.tsx # API key configuration
│   └── ...
├── App.tsx             # Main application component
├── types.ts            # TypeScript type definitions
├── modelConfig.ts      # AI model configurations
├── constants.tsx       # Application constants
└── leonardo.css        # Custom styles
```

## Building for Production

```bash
npm run build
```

The built application will be in the `dist` directory, ready for deployment.

## Development

```bash
npm run dev     # Start development server
npm run build   # Build for production
npm run preview # Preview production build
```

## Contributing

This project is designed for AI image generation workflows. When contributing:

1. Follow the existing code style and structure
2. Test with multiple models and settings
3. Ensure API integrations work correctly
4. Update documentation as needed

## License

This project is for educational and development purposes. Ensure compliance with Leonardo.ai's terms of service when using their API.
