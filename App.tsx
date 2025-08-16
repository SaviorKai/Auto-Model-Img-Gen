import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MediaItem } from './types';
import { IMAGE_GEN_STYLES, CONTRAST_VALUES, getModelId, ASPECT_RATIO_DIMENSIONS, modelSupports, getModelsForNodeType } from './modelConfig';
import ImageViewer from './components/ImageViewer';
import SettingsModal from './components/SettingsModal';
import { GoogleGenAI } from "@google/genai";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface ReferenceImage {
  id: string;
  file: File;
  url: string;
  uploadedId?: string; // Leonardo API ID after upload
  isUploading: boolean;
  uploadError?: string;
}

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
  referenceImages?: ReferenceImage[]; // Store reference images used
}

const App: React.FC = () => {
  // Core state
  const [prompt, setPrompt] = useState<string>('');
  const [generationJobs, setGenerationJobs] = useState<GenerationJob[]>([]);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  
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

  // Auto-resize textarea function
  const autoResizeTextarea = useCallback(() => {
    if (promptInputRef.current) {
      promptInputRef.current.style.height = '48px'; // Reset to minimum
      promptInputRef.current.style.height = `${Math.max(48, promptInputRef.current.scrollHeight)}px`;
    }
  }, []);

  // Auto-resize textarea when prompt changes
  useEffect(() => {
    autoResizeTextarea();
  }, [prompt, autoResizeTextarea]);

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

  // Image Reference Functions
  const uploadImageToLeonardo = async (file: File): Promise<string> => {
    console.log(`Starting upload for file: ${file.name}, size: ${file.size}, type: ${file.type}`);
    
    if (!apiKey) {
      console.error("API key not set");
      throw new Error("API key not set");
    }

    // Convert file to base64 for direct API upload (workaround for CORS issues)
    const convertToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          // Remove the data:image/jpeg;base64, prefix
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = error => reject(error);
      });
    };

    try {
      console.log('Converting image to base64...');
      const base64Data = await convertToBase64(file);
      console.log(`Base64 conversion complete, length: ${base64Data.length}`);
      
      // Try direct upload via Leonardo API with base64
      console.log('Attempting direct base64 upload to Leonardo API...');
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      
      const uploadResponse = await fetch('https://cloud.leonardo.ai/api/rest/v1/upload-init-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          extension: extension,
          imageDataUrl: `data:${file.type};base64,${base64Data}`
        })
      });

      console.log(`Direct upload response status: ${uploadResponse.status}`);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error(`Direct upload failed: ${uploadResponse.status} - ${errorText}`);
        
        // Fallback to the original presigned URL method
        console.log('Direct upload failed, trying presigned URL method...');
        return await uploadViaPresignedUrl(file);
      }

      const uploadData = await uploadResponse.json();
      console.log('Direct upload response:', uploadData);
      
      if (uploadData.uploadInitImageByUrl && uploadData.uploadInitImageByUrl.id) {
        const imageId = uploadData.uploadInitImageByUrl.id;
        console.log(`Direct upload successful! Image ID: ${imageId}`);
        return imageId;
      } else {
        console.error('Invalid direct upload response structure:', uploadData);
        throw new Error('Invalid response from direct upload');
      }
      
    } catch (error) {
      console.error('Direct upload error:', error);
      console.log('Falling back to presigned URL method...');
      return await uploadViaPresignedUrl(file);
    }
  };

  // Fallback method using presigned URLs (original implementation)
  const uploadViaPresignedUrl = async (file: File): Promise<string> => {
    console.log('Using presigned URL upload method...');
    
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    console.log(`Requesting upload URL for extension: ${extension}`);
    
    const initResponse = await fetch('https://cloud.leonardo.ai/api/rest/v1/init-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ extension })
    });

    console.log(`Init response status: ${initResponse.status}`);

    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      console.error(`Init request failed: ${initResponse.status} - ${errorText}`);
      throw new Error(`Failed to request upload URL (${initResponse.status}): ${errorText}`);
    }

    const initData = await initResponse.json();
    console.log('Init response data:', initData);
    
    const { uploadInitImage } = initData;
    if (!uploadInitImage) {
      console.error('Invalid init response structure:', initData);
      throw new Error('Invalid response structure from Leonardo API');
    }
    
    const { id, url: uploadUrl, fields: fieldsString } = uploadInitImage;
    if (!id || !uploadUrl || !fieldsString) {
      console.error('Missing required fields in uploadInitImage:', uploadInitImage);
      throw new Error('Missing required fields in Leonardo API response');
    }
    
    // Parse the fields JSON string
    let fields;
    try {
      fields = JSON.parse(fieldsString);
    } catch (error) {
      console.error('Failed to parse fields JSON:', fieldsString);
      throw new Error('Invalid fields format in Leonardo API response');
    }

    console.log(`Upload URL received, uploading to: ${uploadUrl}`);

    // Create FormData with CORS headers disabled
    const formData = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      formData.append(key, value as string);
    });
    formData.append('file', file);

    console.log('Attempting CORS-disabled upload...');
    
    try {
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        mode: 'no-cors', // Try no-cors mode
      });

      console.log(`No-CORS upload response status: ${uploadResponse.status}`);
      
      // In no-cors mode, we can't read the response, but if no error was thrown, assume success
      if (uploadResponse.type === 'opaque') {
        console.log('No-CORS upload appears successful (opaque response)');
        return id;
      }
      
      throw new Error('No-CORS upload failed');
      
    } catch (corsError) {
      console.error('CORS upload failed:', corsError);
      throw new Error(`Upload failed due to CORS restrictions: ${(corsError as Error).message}`);
    }
  };

  const addReferenceImage = async (file: File) => {
    console.log(`Adding reference image: ${file.name}`);
    
    if (referenceImages.length >= 6) {
      alert('Maximum 6 reference images allowed');
      return;
    }

    const imageId = `ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const imageUrl = URL.createObjectURL(file);
    
    const newImage: ReferenceImage = {
      id: imageId,
      file,
      url: imageUrl,
      isUploading: true
    };

    setReferenceImages(prev => [...prev, newImage]);

    try {
      console.log(`Starting upload for image ${imageId}`);
      const uploadedId = await uploadImageToLeonardo(file);
      console.log(`Upload completed for image ${imageId}, Leonardo ID: ${uploadedId}`);
      
      setReferenceImages(prev => prev.map(img => 
        img.id === imageId 
          ? { ...img, uploadedId, isUploading: false }
          : img
      ));
    } catch (error) {
      console.error(`Upload failed for image ${imageId}:`, error);
      const errorMessage = (error as Error).message;
      
      setReferenceImages(prev => prev.map(img => 
        img.id === imageId 
          ? { ...img, isUploading: false, uploadError: errorMessage }
          : img
      ));
      
      // Also show an alert for immediate user feedback
      alert(`Failed to upload ${file.name}: ${errorMessage}`);
    }
  };

  const removeReferenceImage = (imageId: string) => {
    setReferenceImages(prev => {
      const imageToRemove = prev.find(img => img.id === imageId);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.url);
      }
      return prev.filter(img => img.id !== imageId);
    });
  };

  const handleImageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    imageFiles.forEach(file => {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert(`File ${file.name} is too large. Maximum size is 10MB.`);
        return;
      }
      addReferenceImage(file);
    });
  }, [referenceImages.length]);

  const handleImagePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    
    imageItems.forEach(item => {
      const file = item.getAsFile();
      if (file) {
        addReferenceImage(file);
      }
    });
  }, [referenceImages.length]);

  // Get image guidance configuration for a model
  const getImageGuidanceConfig = (modelName: string) => {
    const guidanceMap: Record<string, { styleRef?: number; charRef?: number; contentRef?: number }> = {
      // Note: FLUX.1 Kontext and FLUX.1 Kontext Pro use contextImages instead of controlnets
      'Flux Dev (Precision)': { styleRef: 299, contentRef: 233 },
      'Flux Schnell (Speed)': { styleRef: 298, contentRef: 232 },
      'Leonardo Phoenix 1.0': { styleRef: 166, charRef: 397, contentRef: 364 },
      'Leonardo Phoenix 0.9': { styleRef: 166, charRef: 397, contentRef: 364 },
      'Leonardo Lightning XL': { styleRef: 67, charRef: 133, contentRef: 100 },
      'Leonardo Anime XL': { styleRef: 67, charRef: 133, contentRef: 100 },
      'Leonardo Diffusion XL': { styleRef: 67, charRef: 133, contentRef: 100 },
      'Leonardo Kino XL': { styleRef: 67, charRef: 133, contentRef: 100 },
      'Leonardo Vision XL': { styleRef: 67, charRef: 133, contentRef: 100 },
      'SDXL 1.0': { styleRef: 67, charRef: 133, contentRef: 100 },
      'AlbedoBase XL': { styleRef: 67, charRef: 133, contentRef: 100 },
      'Lucid Realism': { styleRef: 431 }, // Only style reference
      'Lucid Origin': { styleRef: 431, contentRef: 430 }
    };
    
    return guidanceMap[modelName] || {};
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
      needsEnhancement: needsEnhancement,
      referenceImages: referenceImages.length > 0 ? [...referenceImages] : undefined
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

        // Add image guidance if reference images are available
        const uploadedImages = referenceImages.filter(img => img.uploadedId && !img.isUploading);
        if (uploadedImages.length > 0) {
          // Flux Kontext models use contextImages instead of controlnets
          if (actualModelToUse === 'FLUX.1 Kontext' || actualModelToUse === 'FLUX.1 Kontext Pro') {
            const contextImages: any[] = [];
            uploadedImages.forEach((img, index) => {
              contextImages.push({
                type: "UPLOADED",
                id: img.uploadedId
              });
              // Flux Kontext supports multiple context images
              if (contextImages.length >= 6) return;
            });
            
            if (contextImages.length > 0) {
              payload.contextImages = contextImages;
            }
          } else {
            // Standard controlnets for other models
            const guidanceConfig = getImageGuidanceConfig(actualModelToUse);
            const controlnets: any[] = [];
            
            // Determine which guidance type to use based on model capabilities and Lucid Realism rule
            let guidanceType: 'styleRef' | 'contentRef' | 'charRef' = 'styleRef';
            let preprocessorId: number | undefined = guidanceConfig.styleRef;
            
            if (actualModelToUse === 'Lucid Realism') {
              // Lucid Realism: only use Style Reference
              guidanceType = 'styleRef';
              preprocessorId = guidanceConfig.styleRef;
            } else if (guidanceConfig.styleRef) {
              // For other models, prefer Style Reference if available
              guidanceType = 'styleRef';
              preprocessorId = guidanceConfig.styleRef;
            } else if (guidanceConfig.contentRef) {
              guidanceType = 'contentRef';
              preprocessorId = guidanceConfig.contentRef;
            }
            
            if (preprocessorId) {
              uploadedImages.forEach((img, index) => {
                const controlnet: any = {
                  initImageId: img.uploadedId,
                  initImageType: "UPLOADED",
                  preprocessorId: preprocessorId,
                  strengthType: "Mid", // Default to Mid strength
                };
                
                // Only add weight for models that support it (exclude Lucid models and others that only use strengthType)
                if (!actualModelToUse.includes('Lucid') && !actualModelToUse.includes('Kino')) {
                  controlnet.weight = 1.0;
                }
                
                controlnets.push(controlnet);
                
                // Limit based on model capabilities
                if (controlnets.length >= 6) return;
              });
              
              if (controlnets.length > 0) {
                payload.controlnets = controlnets;
              }
            }
          }
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
            {/* Unified Prompt Box Container */}
            <div 
              style={{ 
                border: '1px solid var(--color-border-input-default)',
                borderRadius: '8px',
                backgroundColor: 'var(--color-surface-input-default)',
                overflow: 'hidden',
                transition: 'border-color 0.15s ease'
              }}
              onDrop={handleImageDrop}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={(e) => e.preventDefault()}
            >
              {/* Row 1: Prompt Textarea */}
              <textarea
                ref={promptInputRef}
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  // Auto-resize on next frame to ensure content is rendered
                  requestAnimationFrame(() => autoResizeTextarea());
                }}
                onKeyPress={handleKeyPress}
                onPaste={handleImagePaste}
                placeholder="A majestic dragon soaring through a cloudy sky at sunset..."
                style={{ 
                  width: '100%',
                  minHeight: '48px',
                  height: '48px',
                  resize: 'none',
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  padding: '16px',
                  fontSize: '14px',
                  overflow: 'hidden',
                  lineHeight: '1.5',
                  fontFamily: 'inherit',
                  color: 'var(--color-content-primary)'
                }}
                disabled={isLoading}
              />
              
              {/* Row 2: Action Bar with Images */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '8px',
                padding: '16px 20px 8px 12px',
                borderTop: '1px solid var(--color-border-input-subtle)',
                backgroundColor: 'var(--color-surface-input-subtle)',
                minHeight: '40px',
                overflow: 'visible'
              }}>
              {/* Add Image Button */}
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.multiple = true;
                  input.onchange = (e) => {
                    const files = Array.from((e.target as HTMLInputElement).files || []);
                    files.forEach(file => {
                      if (file.size > 10 * 1024 * 1024) {
                        alert(`File ${file.name} is too large. Maximum size is 10MB.`);
                        return;
                      }
                      addReferenceImage(file);
                    });
                  };
                  input.click();
                }}
                disabled={referenceImages.length >= 6}
                className="leo-button leo-button-secondary leo-button-sm"
                style={{
                  width: referenceImages.length > 0 ? '48px' : '32px',
                  height: referenceImages.length > 0 ? '48px' : '32px',
                  minWidth: referenceImages.length > 0 ? '48px' : '32px',
                  flexShrink: 0,
                  padding: '0',
                  alignSelf: 'flex-end'
                }}
                title={referenceImages.length >= 6 ? "Maximum 6 images allowed" : "Add reference image"}
              >
<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
              
              {/* Reference Images */}
              {referenceImages.length > 0 && (
                <div style={{
                  display: 'flex',
                  gap: '6px',
                  flex: 1,
                  alignItems: 'flex-end',
                  paddingTop: '8px',
                  paddingRight: '12px'
                }}>
                  {referenceImages.map((img) => (
                    <div key={img.id} style={{
                      position: 'relative',
                      width: '48px',
                      height: '48px',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      border: '1px solid var(--color-border-input-default)',
                      backgroundColor: 'white',
                      flexShrink: 0
                    }}>
                      <img
                        src={img.url}
                        alt={`Reference ${img.file.name}`}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                      
                      {/* Upload Status Overlays */}
                      {img.isUploading && (
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: 'rgba(0, 0, 0, 0.7)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white'
                        }}>
                          <div className="leo-spinner" style={{ width: '12px', height: '12px' }}></div>
                        </div>
                      )}
                      
                      {img.uploadError && (
                        <div 
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(228, 78, 68, 0.9)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                          }}
                          title={`Upload failed: ${img.uploadError}`}
                        >
                          <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      
                      
                      {/* Remove Button */}
                      <button
                        onClick={() => removeReferenceImage(img.id)}
                        style={{
                          position: 'absolute',
                          top: '2px',
                          right: '2px',
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          backgroundColor: '#000000',
                          border: '1px solid white',
                          color: 'white',
                          fontSize: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
                        }}
                        title={`Remove ${img.file.name}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  
                </div>
              )}
              
              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isButtonDisabled}
                className={`leo-button leo-button-sm ${!prompt.trim() || isButtonDisabled ? 'leo-button-ghost' : 'leo-button-primary'}`}
                style={{
                  marginLeft: 'auto',
                  minWidth: '80px',
                  height: '32px',
                  fontSize: '13px',
                  flexShrink: 0
                }}
              >
                Generate
              </button>
              </div>
            </div>
            
            <p className="leo-text-xs leo-text-secondary" style={{ minHeight: '1.125rem', marginTop: '8px' }}>
              {!isLoading && (
                <span>
                  Press Enter to generate • Shift + Enter for new line
                  {referenceImages.length === 0 && " • Drag/drop or paste images for reference"}
                  {referenceImages.length > 0 && ` • ${referenceImages.length}/6 reference images`}
                </span>
              )}
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
                            {job.referenceImages && job.referenceImages.length > 0 && (
                              <span className="leo-badge leo-badge-tertiary" title={`${job.referenceImages.length} reference images`}>
                                🖼️ {job.referenceImages.length}
                              </span>
                            )}
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