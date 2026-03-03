import { GoogleGenAI, Modality, VideoGenerationReferenceImage, VideoGenerationReferenceType } from "@google/genai";

export const VOICE_NAME = 'Fenrir'; // Deep cinematic male voice

export async function hasApiKey() {
  return await (window as any).aistudio.hasSelectedApiKey();
}

export async function openApiKeyDialog() {
  await (window as any).aistudio.openSelectKey();
}

export async function generateNarration(text: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Say in a deep, cinematic, dramatic male voice: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: VOICE_NAME },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Failed to generate audio narration");
  
  return base64Audio;
}

export async function generateComicVideo(prompt: string, onProgress?: (status: string) => void) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  onProgress?.("Starting video generation...");
  
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt,
    config: {
      numberOfVideos: 1,
      resolution: '1080p',
      aspectRatio: '9:16'
    }
  });

  while (!operation.done) {
    onProgress?.("Generating cinematic panels... (this may take a minute)");
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Failed to generate video");

  return {
    videoUrl: `${downloadLink}&x-goog-api-key=${process.env.GEMINI_API_KEY}`,
    operation
  };
}

export async function extendVideo(previousOperation: any, prompt: string, onProgress?: (status: string) => void) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  onProgress?.("Extending the story...");
  
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-generate-preview', // Use generate-preview for extensions
    prompt: prompt,
    video: previousOperation.response?.generatedVideos?.[0]?.video,
    config: {
      numberOfVideos: 1,
      resolution: '720p', // Extensions often require 720p
      aspectRatio: '9:16',
    }
  });

  while (!operation.done) {
    onProgress?.("Animating next scene...");
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Failed to extend video");

  return {
    videoUrl: `${downloadLink}&x-goog-api-key=${process.env.GEMINI_API_KEY}`,
    operation
  };
}
