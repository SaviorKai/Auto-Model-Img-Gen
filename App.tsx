import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MediaItem } from './types';
import { IMAGE_GEN_STYLES, CONTRAST_VALUES, getModelId, ASPECT_RATIO_DIMENSIONS, modelSupports, getModelsForNodeType } from './modelConfig';
import ImageViewer from './components/ImageViewer';
import SettingsModal from './components/SettingsModal';
import { GoogleGenAI } from "@google/genai";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface GenerationJob {
  id: string;
  prompt: string;
  enhancedPrompt?: string; // Store the enhanced prompt separately
  numImages: number;
  status: 'enhancing' | 'loading' | 'completed' | 'error';
  error?: string;
  images: MediaItem[];
  timestamp: number;
  model: string;
  actualModel?: string; // The model that was actually selected by Auto
  aspectRatio: string;
  needsEnhancement: boolean; // Flag to indicate if enhancement is needed
}

const App: React.FC = () => {
  // Core state
  const [prompt, setPrompt] = useState<string>('');
  const [generationJobs, setGenerationJobs] = useState<GenerationJob[]>([]);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);
  
  // Settings state  
  const [selectedModel, setSelectedModel] = useState<string>('Auto');
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [numImages, setNumImages] = useState<number>(4);
  const [style, setStyle] = useState<string>('Dynamic');
  const [contrast, setContrast] = useState<number>(1.0);
  const [seed, setSeed] = useState<string>('');
  const [promptEnhance, setPromptEnhance] = useState<boolean>(false);
  const [geminiEnhanceEnabled, setGeminiEnhanceEnabled] = useState<boolean>(false);
  
  // UI state
  const [isMobile, setIsMobile] = useState(false);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const [hasSecretsFile, setHasSecretsFile] = useState(false);
  
  // Refs
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  // Functions
  const loadSecretsFromFile = async (): Promise<{ leonardoKey?: string; geminiKey?: string; hasFile: boolean }> => {
    try {
      const response = await fetch('/secrets.md');
      if (response.ok) {
        const content = await response.text();
        const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
        
        let leonardoKey = '';
        let geminiKey = '';
        let expectingLeoKey = false;
        let expectingGeminiKey = false;
        
        for (const line of lines) {
          if (line.toLowerCase().includes('leo key:')) {
            expectingLeoKey = true;
            expectingGeminiKey = false;
          } else if (line.toLowerCase().includes('gemini key:')) {
            expectingGeminiKey = true;
            expectingLeoKey = false;
          } else if (expectingLeoKey && line.length > 10 && !line.includes(':')) {
            leonardoKey = line;
            expectingLeoKey = false;
          } else if (expectingGeminiKey && line.length > 10 && !line.includes(':')) {
            geminiKey = line;
            expectingGeminiKey = false;
          }
        }
        
        return { leonardoKey, geminiKey, hasFile: true };
      }
    } catch (error) {
      // File doesn't exist or can't be read
    }
    return { hasFile: false };
  };

  // Effects
  useEffect(() => {
    // Load secrets on startup
    loadSecretsFromFile().then(({ leonardoKey, geminiKey, hasFile }) => {
      setHasSecretsFile(hasFile);
      if (hasFile && leonardoKey) {
        setApiKey(leonardoKey);
        localStorage.setItem('leonardo-api-key', leonardoKey);
      }
      if (hasFile && geminiKey) {
        setGeminiApiKey(geminiKey);
        localStorage.setItem('gemini-api-key', geminiKey);
      }
    });
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize(); // Set initial value
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const storedApiKey = localStorage.getItem('leonardo-api-key');
    if (storedApiKey) setApiKey(storedApiKey);
    const storedGeminiApiKey = localStorage.getItem('gemini-api-key');
    if (storedGeminiApiKey) setGeminiApiKey(storedGeminiApiKey);
  }, []);

  const handleSaveSettings = (leoKey: string, geminiKey: string) => {
    setApiKey(leoKey);
    localStorage.setItem('leonardo-api-key', leoKey);
    setGeminiApiKey(geminiKey);
    localStorage.setItem('gemini-api-key', geminiKey);
    setSettingsModalOpen(false);
  };

  const enhanceWithGemini = async (userPrompt: string): Promise<{ enhancedPrompt: string, recommendedModel: string }> => {
    if (!geminiApiKey) {
      throw new Error("Google Gemini API key not set. Please add it in settings.");
    }

    const promptTemplate = `You are an AI assistant specializing in enhancing user image prompts for creative and safe image generation. Your primary goal is to enrich prompts by adding vivid, detailed descriptions while respecting user specifications and maintaining content safety.

Detailed Guidelines:

1. Enrich User Prompts:
   - Enhance prompts to make them more descriptive, focusing on observable details like subject, medium, aesthetics, colors, style, layout, and framing. Avoid adding unnecessary elements not aligned with the user's intent.

2. Respect User-Specified Attributes:
   - When the user specifies details such as race, gender, age, skin color, or group composition, preserve these details exactly as stated.
   - Only if these attributes are not specified, aim for inclusivity and diversity in descriptions.

3. Content Safety Moderation:
   - Disallowed Content: Remove inappropriate or harmful elements such as violence, nudity, sexual content, illegal activities, or copyrighted materials. Do so seamlessly, without drawing attention to omissions.
   - Circumvention Attempts: Replace ambiguous or misspelled phrases with safe, appropriate alternatives aligned with the user's intent.
   - People Descriptions: Ensure all depictions of people are respectful and avoid suggestive or exploitative language, especially involving minors.
   - Minors: Redirect any prompt involving minors and potentially inappropriate descriptions to entirely safe and neutral depictions.
   - Avoid Replicating Popular Fictional Characters: You do not replicate popular fictional and animated characters which are copyrighted.

4. Formatting and Style:
   - Respond in one concise paragraph, formatted as follows: <updated_prompt> updated_prompt </updated_prompt>
   - Ensure responses are in English, free of filler words, and maintain the original level of detail unless safety modifications are required.

5. Special Cases:
   - For black-and-white images, honor the request explicitly. Default to color if unspecified.
   - Do not replicate or reference copyrighted fictional characters.

6. Preserving User Intent Safely:
   - Strive to align with the user's original vision while ensuring all output remains appropriate for a general audience.

Given the user's prompt:
<image_prompt> 
{{prompt }}
</image_prompt>

Enhance and return it in the following format:
<updated_prompt>
{{updated prompt}}
</updated_prompt>

In addition, add to your response separate to <updated_prompt>:
If the user's prompt requires text to be added / rendered in the image, use 'Flux Kontext', else use 'Lucid Origin'
<model_to_use>
{{recommended model}}
</model_to_use>`;

    const fullPrompt = promptTemplate.replace('{{prompt }}', userPrompt);

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
    });

    const resultText = response.text;
    
    const updatedPromptMatch = resultText.match(/<updated_prompt>([\s\S]*?)<\/updated_prompt>/);
    const modelToUseMatch = resultText.match(/<model_to_use>([\s\S]*?)<\/model_to_use>/);

    const enhancedPrompt = updatedPromptMatch ? updatedPromptMatch[1].trim() : userPrompt;
    let recommendedModel = modelToUseMatch ? modelToUseMatch[1].trim() : 'Lucid Origin';

    // Map model name from Gemini to the one in our config
    if (recommendedModel === 'Flux Kontext') {
        // "Flux Kontext" from the prompt refers to a model capable of rendering text.
        // "FLUX.1 Kontext Pro" is the image generation model for this purpose.
        recommendedModel = 'FLUX.1 Kontext Pro';
    }

    // Validate that the recommended model exists in our configuration
    const allImageModels = getModelsForNodeType('image-generation');
    if (!allImageModels.includes(recommendedModel)) {
        console.warn(`Gemini recommended an unknown model: "${recommendedModel}". Falling back to Lucid Origin.`);
        recommendedModel = 'Lucid Origin';
    }

    return { enhancedPrompt, recommendedModel };
  };

  const handleGenerate = async () => {
    const needsEnhancement = selectedModel === 'Auto' || geminiEnhanceEnabled;

    if (!apiKey) {
      alert("Please set your Leonardo AI API key in settings.");
      setSettingsModalOpen(true);
      return;
    }
    
    if (needsEnhancement && !geminiApiKey) {
      alert("Please set your Google Gemini API key in settings to use prompt enhancement.");
      setSettingsModalOpen(true);
      return;
    }

    const currentPrompt = prompt.trim();
    if (!currentPrompt) {
      alert('Please enter a prompt');
      return;
    }

    // Brief disable to prevent spam
    setIsButtonDisabled(true);
    setTimeout(() => setIsButtonDisabled(false), 150);

    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const runId = Date.now();
    
    const initialStatus = needsEnhancement ? 'enhancing' : 'loading';
    
    // Create job immediately - no waiting for enhancement
    const newJob: GenerationJob = {
      id: jobId,
      prompt: currentPrompt, // Store original prompt
      numImages: numImages,
      status: initialStatus,
      images: [],
      timestamp: runId,
      model: selectedModel,
      actualModel: selectedModel === 'Auto' ? undefined : selectedModel,
      aspectRatio: aspectRatio,
      needsEnhancement: needsEnhancement
    };
    
    setGenerationJobs(prev => [newJob, ...prev]);

    // Process generation in background
    (async () => {
      let promptToSend = currentPrompt;
      let actualModelToUse = selectedModel;
      let jobModelName = selectedModel;
      let actualModelForJob = selectedModel === 'Auto' ? undefined : selectedModel;

      try {
        // Handle enhancement if needed
        if (needsEnhancement) {
          try {
            const { enhancedPrompt, recommendedModel } = await enhanceWithGemini(currentPrompt);
            
            promptToSend = enhancedPrompt;
            
            if (selectedModel === 'Auto') {
              // Auto mode: use recommended model
              actualModelToUse = recommendedModel;
              jobModelName = 'Auto';
              actualModelForJob = recommendedModel;
            } else {
              // Manual enhancement: keep selected model
              actualModelToUse = selectedModel;
              jobModelName = selectedModel;
              actualModelForJob = selectedModel;
            }

            // Update job with enhanced prompt and move to loading
            setGenerationJobs(prev => prev.map(job => 
              job.id === jobId 
                ? { ...job, enhancedPrompt: promptToSend, status: 'loading' as const, actualModel: actualModelForJob }
                : job
            ));
          } catch (error) {
            console.error("Error enhancing prompt with Gemini:", error);
            
            if (selectedModel === 'Auto') {
              actualModelToUse = 'Lucid Origin';
              jobModelName = 'Auto';
              actualModelForJob = 'Lucid Origin';
            } else {
              actualModelToUse = selectedModel;
              actualModelForJob = selectedModel;
            }
            promptToSend = currentPrompt;

            // Update job with error info but continue with original prompt
            setGenerationJobs(prev => prev.map(job => 
              job.id === jobId 
                ? { ...job, status: 'loading' as const, actualModel: actualModelForJob }
                : job
            ));
          }
        }

        const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio] || { width: 1024, height: 1024 };
        
        let payload: any = {
          prompt: promptToSend,
          modelId: getModelId(actualModelToUse),
          num_images: numImages,
          width: dimensions.width,
          height: dimensions.height,
          seed: seed ? parseInt(seed) : null,
        };

        // Add prompt enhancement for supported models
        if (promptEnhance && modelSupports(actualModelToUse, 'promptEnhance')) {
          payload.promptEnhance = promptEnhance;
        }
        
        const isAlchemyModel = modelSupports(actualModelToUse, 'alchemy');

        if (isAlchemyModel) {
          payload.alchemy = true;
          if (actualModelToUse.includes('Phoenix')) {
            payload.contrast = Math.max(contrast, 2.5);
          }
        } else if (modelSupports(actualModelToUse, 'contrast')) {
          payload.contrast = contrast;
        }

        if (style && style !== 'None') {
          payload.presetStyle = style.toUpperCase().replace(/ /g, '_');
        }

        const genResponse = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(payload)
        });

        if (!genResponse.ok) {
          throw new Error(`API Error: ${await genResponse.text()}`);
        }

        const genJson = await genResponse.json();
        const generationId = genJson?.sdGenerationJob?.generationId;

        if (!generationId) {
          throw new Error(`API response malformed. Response: ${JSON.stringify(genJson)}`);
        }

        // Poll for completion
        let pollResult;
        let status = 'PENDING';
        while (status === 'PENDING' || status === 'PROCESSING') {
          await sleep(3000);
          const pollResponse = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          pollResult = await pollResponse.json();
          status = pollResult.generations_by_pk.status;
        }

        if (status === 'FAILED') {
          throw new Error('Generation failed.');
        }

        const finalResult = pollResult.generations_by_pk;

        if (finalResult?.generated_images?.length > 0) {
          const newImages = finalResult.generated_images.map((item: any) => ({
            mediaId: item.id,
            url: item.url,
            type: 'image' as const,
            sourceType: 'generated' as const,
            runId,
            timestamp: Date.now()
          }));

          // Update job with completed images
          setGenerationJobs(prev => prev.map(job => 
            job.id === jobId 
              ? { ...job, status: 'completed' as const, images: newImages }
              : job
          ));
        }

      } catch (error) {
        console.error('Generation error:', error);
        // Update job with error
        setGenerationJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { ...job, status: 'error' as const, error: (error as Error).message }
            : job
        ));
      }
    })();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const dismissError = (jobId: string) => {
    setGenerationJobs(prev => prev.filter(job => job.id !== jobId));
  };

  const allGenerations = generationJobs.flatMap(job => job.images);
  const hasActiveGenerations = generationJobs.some(job => job.status === 'loading' || job.status === 'enhancing');
  const isLoading = false; // No longer lock UI during generation

  const allImageModels = getModelsForNodeType('image-generation');
  const imageModels = ['Auto', ...allImageModels.filter(model => model !== 'Auto')];
  const videoModels = getModelsForNodeType('text-to-video');
  const imageEditModels = getModelsForNodeType('image-edit');


  return (
    <div className="leo-app-layout">
      {/* Left Sidebar */}
      <fieldset disabled={isLoading} className="leo-app-sidebar">
        <div className="leo-stack leo-stack-8">
          <h1 className="leo-text-xl leo-font-medium leo-text-primary">AI Image Generator</h1>
          
          {/* Model Selection */}
          <div className="leo-stack leo-stack-6">
            <div className="leo-stack leo-stack-3">
              <h3 className="leo-text-sm leo-font-medium leo-text-secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Model</h3>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="leo-select"
              >
                <optgroup label="Image Generation Models">
                  {imageModels.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </optgroup>
                <optgroup label="Image Editing Models">
                  {imageEditModels.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </optgroup>
                <optgroup label="Video Generation Models">
                  {videoModels.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Settings */}
          <div className="leo-stack leo-stack-6">
            <h3 className="leo-text-sm leo-font-medium leo-text-secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Settings</h3>
            
            <div className="leo-stack leo-stack-3">
              <label className="leo-text-sm leo-font-medium leo-text-secondary">Style</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="leo-select"
              >
                {IMAGE_GEN_STYLES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="leo-stack leo-stack-3">
              <label className="leo-text-sm leo-font-medium leo-text-secondary">Aspect Ratio</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="leo-select"
              >
                {Object.keys(ASPECT_RATIO_DIMENSIONS).map(ratio => (
                  <option key={ratio} value={ratio}>{ratio}</option>
                ))}
              </select>
            </div>

            <div className="leo-stack leo-stack-3">
              <label className="leo-text-sm leo-font-medium leo-text-secondary">
                Number of Images: {numImages}
              </label>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={numImages}
                onChange={(e) => setNumImages(parseInt(e.target.value))}
                className="leo-range"
              />
            </div>

            {modelSupports(selectedModel === 'Auto' ? 'Leonardo Phoenix 1.0' : selectedModel, 'contrast') && (
              <div className="leo-stack leo-stack-3">
                <label className="leo-text-sm leo-font-medium leo-text-secondary">Contrast</label>
                <select
                  value={contrast}
                  onChange={(e) => setContrast(parseFloat(e.target.value))}
                  className="leo-select"
                >
                  {CONTRAST_VALUES.map(val => (
                    <option key={val} value={val}>{val}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="leo-stack leo-stack-3">
              <label className="leo-text-sm leo-font-medium leo-text-secondary">Seed (optional)</label>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="Random"
                className="leo-input"
              />
            </div>


            {selectedModel !== 'Auto' && (
              <div className="leo-cluster leo-cluster-4" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <label 
                    htmlFor="gemini-enhance-toggle" 
                    className={`leo-text-sm leo-font-medium ${geminiApiKey ? 'leo-text-secondary' : 'leo-text-disabled'} leo-transition-fast`}
                    style={{ cursor: geminiApiKey ? 'pointer' : 'default' }}
                  >
                    AI Prompt Enhancement
                  </label>
                  {!geminiApiKey && (
                    <p className="leo-text-xs leo-text-disabled" style={{ marginTop: '4px' }}>
                      Set Gemini API Key in Settings to enable.
                    </p>
                  )}
                </div>
                <label className="leo-toggle">
                  <input
                    id="gemini-enhance-toggle"
                    type="checkbox"
                    checked={geminiEnhanceEnabled}
                    onChange={(e) => setGeminiEnhanceEnabled(e.target.checked)}
                    disabled={!geminiApiKey}
                  />
                  <span className="leo-toggle-slider"></span>
                </label>
              </div>
            )}
          </div>

          <button
            onClick={() => setSettingsModalOpen(true)}
            className="leo-button leo-button-secondary leo-button-md"
            style={{ width: '100%' }}
            disabled={hasSecretsFile}
            title={hasSecretsFile ? "API keys are loaded from secrets.md file" : "Configure API keys"}
          >
            API Settings {hasSecretsFile && '(from file)'}
          </button>
        </div>
      </fieldset>

      {/* Main Content */}
      <div className="leo-app-main">
        {/* Prompt Area */}
        <div className="leo-app-prompt-area">
          <div className="leo-stack leo-stack-2">
            <label className="leo-text-sm leo-font-medium leo-text-secondary">
              Describe what you want to generate
            </label>
            <div style={{ position: 'relative' }}>
              <textarea
                ref={promptInputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="A majestic dragon soaring through a cloudy sky at sunset..."
                className="leo-textarea"
                style={{ height: '96px', paddingRight: '100px' }}
                disabled={isLoading}
              />
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isButtonDisabled}
                className={`leo-button leo-button-sm ${!prompt.trim() || isButtonDisabled ? 'leo-button-ghost' : 'leo-button-primary'}`}
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  right: '12px'
                }}
              >
                Generate
              </button>
            </div>
            <p className="leo-text-xs leo-text-secondary" style={{ minHeight: '1.125rem' }}>
              {!isLoading && <span>Press Enter to generate • Shift + Enter for new line</span>}
              {hasActiveGenerations && (
                <span className="leo-text-highlight">
                  {generationJobs.filter(job => job.status === 'loading' || job.status === 'enhancing').length} generation(s) in progress...
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Generation History */}
        <div className="leo-app-generations">
          <div className="leo-app-generations-header">
            <h2 className="leo-text-lg leo-font-medium leo-text-primary">Generated Images</h2>
          </div>
          <div className="leo-app-generations-content">
            <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
            {generationJobs.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: '48px', paddingBottom: '48px' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  marginBottom: '16px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-surface-input-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px'
                }}>
                  <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="leo-text-secondary">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="leo-text-lg leo-font-medium leo-text-secondary">No images generated yet</p>
                <p className="leo-text-sm leo-text-tertiary" style={{ marginTop: '4px' }}>
                  Enter a prompt above and click Generate to create your first image
                </p>
              </div>
            ) : (
              <div className="leo-stack leo-stack-8">
                {generationJobs.map((job) => (
                  <div key={job.id} className="leo-generation-job">
                    {/* Job Header */}
                    <div className="leo-generation-job-header">
                      <div className="leo-generation-job-info">
                        <div className="leo-cluster leo-cluster-3" style={{ marginBottom: '4px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p className="leo-text-base leo-font-medium leo-text-primary leo-truncate">
                              {job.enhancedPrompt || job.prompt}
                            </p>
                            {job.enhancedPrompt && job.enhancedPrompt !== job.prompt && (
                              <p className="leo-text-sm leo-text-secondary leo-truncate" style={{ marginTop: '2px' }}>
                                Original: {job.prompt}
                              </p>
                            )}
                          </div>
                          <div className="leo-generation-job-meta">
                            <span className="leo-badge leo-badge-secondary">
                              {job.actualModel ? `${job.model} → ${job.actualModel}` : job.model}
                            </span>
                            <span className="leo-badge leo-badge-primary">
                              {job.aspectRatio}
                            </span>
                            {job.status === 'enhancing' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div className="leo-spinner"></div>
                                <span className="leo-text-sm leo-font-medium leo-text-highlight">Enhancing...</span>
                              </div>
                            )}
                            {job.status === 'loading' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div className="leo-spinner"></div>
                                <span className="leo-text-sm leo-font-medium leo-text-notification">Generating...</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="leo-text-xs leo-text-tertiary">
                          {new Date(job.timestamp).toLocaleString()} • {job.numImages} images
                        </p>
                      </div>
                      {job.status === 'error' && (
                        <button
                          onClick={() => dismissError(job.id)}
                          className="leo-button leo-button-ghost leo-button-sm leo-text-negative"
                          title="Dismiss error"
                        >
                          <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Error Message */}
                    {job.status === 'error' && (
                      <div className="leo-surface" style={{
                        backgroundColor: 'rgba(228, 78, 68, 0.1)',
                        borderColor: 'var(--color-content-negative)',
                        padding: '16px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px'
                      }}>
                        <svg width="20" height="20" className="leo-text-negative" fill="currentColor" viewBox="0 0 20 20" style={{ flexShrink: 0, marginTop: '2px' }}>
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <p className="leo-text-sm leo-font-medium leo-text-negative">Generation failed</p>
                          <p className="leo-text-sm leo-text-negative" style={{ marginTop: '4px', opacity: 0.8 }}>{job.error}</p>
                        </div>
                      </div>
                    )}

                    {/* Images Grid */}
                    <div className="leo-generation-images-grid">
                      {/* Loading placeholders */}
                      {(job.status === 'enhancing' || job.status === 'loading') &&
                        Array.from({ length: job.numImages }, (_, index) => (
                          <div key={`placeholder-${index}`} className="leo-loading-placeholder">
                            <div className="leo-loading-placeholder-image">
                              <div className="leo-spinner leo-spinner-lg"></div>
                            </div>
                            <div className="leo-loading-placeholder-text"></div>
                          </div>
                        ))
                      }
                      
                      {/* Completed images */}
                      {job.status === 'completed' &&
                        job.images.map((item, index) => (
                          <div key={`${item.mediaId}-${index}`} className="leo-generation-image-card">
                            <ImageViewer
                              src={item.url}
                              alt={`Generated image ${index + 1}`}
                              className="leo-generation-image"
                              images={allGenerations.map(g => ({ src: g.url, alt: `Generated image` }))}
                              sidebarOpen={false}
                            />
                          </div>
                        ))
                      }
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsModalOpen} 
        onClose={() => setSettingsModalOpen(false)}
        onSave={(newApiKey: string, newGeminiApiKey: string, devMode: boolean) => {
          handleSaveSettings(newApiKey, newGeminiApiKey);
          setSettingsModalOpen(false);
        }}
        currentApiKey={apiKey}
        currentGeminiApiKey={geminiApiKey}
        isDevMode={false}
      />

      {/* Secrets File Warning */}
      {hasSecretsFile && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(239, 68, 68, 0.9)',
          color: '#FFFFFF',
          padding: '8px 16px',
          fontSize: '12px',
          fontWeight: 500,
          textAlign: 'center',
          zIndex: 1000,
          borderTop: '1px solid rgba(239, 68, 68, 1)'
        }}>
          ⚠️ secrets.md file detected - API keys loaded from file
        </div>
      )}
    </div>
  );
};

export default App;