import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Play, 
  Download, 
  Film, 
  Mic, 
  Loader2, 
  Shield, 
  Sparkles,
  ChevronRight,
  Volume2,
  Share2
} from 'lucide-react';
import { 
  hasApiKey, 
  openApiKeyDialog, 
  generateNarration, 
  generateComicVideo,
  extendVideo 
} from './services/gemini';

const COMIC_STYLES = [
  { 
    id: 'classic', 
    name: 'Classic', 
    description: 'Classic American comic book style, bold ink outlines, halftone shading, dramatic shadows, vibrant high-contrast colors.' 
  },
  { 
    id: 'manga', 
    name: 'Manga', 
    description: 'Japanese manga style, clean lines, screentone patterns, expressive characters, dynamic action lines, black and white with selective color.' 
  },
  { 
    id: 'noir', 
    name: 'Noir', 
    description: 'Gritty detective noir style, high contrast black and white, heavy shadows, moody lighting, rain-slicked streets, cinematic silhouettes.' 
  },
  { 
    id: 'western', 
    name: 'Western', 
    description: 'Classic Western comic style, dusty textures, warm earthy tones, rugged characters, wide landscape shots, sun-drenched lighting.' 
  },
  { 
    id: 'indie', 
    name: 'Indie Comic', 
    description: 'Alternative indie comic style, hand-drawn textures, experimental layouts, muted color palette, unique character designs, artistic brushstrokes.' 
  }
];

const TEXT_FONTS = [
  { id: 'comic', name: 'Comic Bold', description: 'Classic hand-lettered comic font' },
  { id: 'impact', name: 'Impact', description: 'Heavy, bold cinematic font' },
  { id: 'modern', name: 'Modern Sans', description: 'Clean, futuristic sans-serif' },
  { id: 'serif', name: 'Classic Serif', description: 'Traditional editorial serif' }
];

const BUBBLE_COLORS = [
  { id: 'white', name: 'Classic White', hex: '#FFFFFF', text: '#000000' },
  { id: 'yellow', name: 'Retro Yellow', hex: '#FFEB3B', text: '#000000' },
  { id: 'orange', name: 'Action Orange', hex: '#FF9800', text: '#FFFFFF' },
  { id: 'black', name: 'Dark Noir', hex: '#000000', text: '#FFFFFF' }
];

const ANIMATION_EFFECTS = [
  { id: 'pop', name: 'Pop-in', description: 'Sudden dynamic appearance' },
  { id: 'shake', name: 'Action Shake', description: 'Vibrating with impact' },
  { id: 'fade', name: 'Smooth Fade', description: 'Elegant cinematic entry' },
  { id: 'zoom', name: 'Zoom-in', description: 'Scaling from the center' }
];

const BASE_PROMPT = `Cinematic transitions, motion lines, dynamic panels.`;

export default function App() {
  const [isKeySelected, setIsKeySelected] = useState<boolean | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState(COMIC_STYLES[0]);
  const [selectedFont, setSelectedFont] = useState(TEXT_FONTS[0]);
  const [selectedBubble, setSelectedBubble] = useState(BUBBLE_COLORS[0]);
  const [selectedAnim, setSelectedAnim] = useState(ANIMATION_EFFECTS[0]);
  const [script, setScript] = useState("A masked hero and a fearless heroine stand on a rooftop at night in a futuristic city. A giant shadow monster rises from the streets below. They fight and win.");
  const [analysis, setAnalysis] = useState<{
    narration: string;
    scenes: Array<{
      visual: string;
      camera_angle: string;
      panel_layout: string;
      pacing: string;
    }>;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    checkKey();
  }, []);

  const checkKey = async () => {
    const selected = await hasApiKey();
    setIsKeySelected(selected);
  };

  const handleSelectKey = async () => {
    await openApiKeyDialog();
    setIsKeySelected(true);
  };

  const startGeneration = async () => {
    if (!script.trim()) {
      setError("Please enter a script or dialogue first.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress("Analyzing your script...");
    
    try {
      // 0. Use Gemini to structure the script into scenes
      const ai = new (await import('@google/genai')).GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const scriptResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Turn this comic script into a structured JSON for a 30-second animation. 
        Provide:
        1. "narration": A dramatic 10-15 word narration text.
        2. "scenes": An array of 5 objects, each describing a visual scene for a comic panel.
           Each object must have:
           - "visual": Detailed visual description.
           - "camera_angle": Suggested camera angle (e.g., low angle, extreme close-up, bird's eye view).
           - "panel_layout": Suggested comic panel layout (e.g., splash page, vertical strip, tilted panel).
           - "pacing": Suggested pacing (e.g., slow motion, rapid cuts, steady pan).
        
        The first scene is the starting point, the next 4 are extensions.
        
        Script: ${script}`,
        config: {
          responseMimeType: "application/json",
        }
      });

      const structuredScript = JSON.parse(scriptResponse.text || "{}");
      setAnalysis(structuredScript);
      
      const narrationText = structuredScript.narration || script.substring(0, 50);
      const scenes = structuredScript.scenes || [];

      const styleDesc = selectedStyle.description;
      const textStyleDesc = `Speech bubbles should use ${selectedFont.description}. Bubbles are ${selectedBubble.name} (${selectedBubble.hex}) with ${selectedBubble.text} text. Text overlays and bubbles should have a ${selectedAnim.name} animation effect (${selectedAnim.description}). Bold outlines on all text.`;
      
      // 1. Generate Narration
      setProgress("Generating cinematic narration...");
      const audioBase64 = await generateNarration(narrationText);
      const audioBlob = await (await fetch(`data:audio/mp3;base64,${audioBase64}`)).blob();
      setAudioUrl(URL.createObjectURL(audioBlob));

      // 2. Generate Initial Video
      const firstScene = scenes[0] || { visual: script, camera_angle: "", panel_layout: "", pacing: "" };
      const initialPrompt = `${styleDesc} ${textStyleDesc} ${BASE_PROMPT} Visual: ${firstScene.visual}. Camera: ${firstScene.camera_angle}. Layout: ${firstScene.panel_layout}. Pacing: ${firstScene.pacing}.`;
      
      let { videoUrl: vUrl, operation } = await generateComicVideo(initialPrompt, (status) => {
        setProgress(status);
      });
      setVideoUrl(vUrl);

      // 3. Extend Video
      for (let i = 1; i < scenes.length; i++) {
        setProgress(`Extending story: Part ${i}/4...`);
        const currentScene = scenes[i];
        const extensionPrompt = `${styleDesc} ${textStyleDesc} ${BASE_PROMPT} Visual: ${currentScene.visual}. Camera: ${currentScene.camera_angle}. Layout: ${currentScene.panel_layout}. Pacing: ${currentScene.pacing}.`;
        
        const result = await extendVideo(operation, extensionPrompt, (status) => {
          setProgress(`Part ${i}/4: ${status}`);
        });
        operation = result.operation;
        setVideoUrl(result.videoUrl);
      }
      
      setProgress("Masterpiece complete!");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during generation.");
      if (err.message?.includes("entity was not found")) {
        setIsKeySelected(false);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  if (isKeySelected === false) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md space-y-8"
        >
          <div className="w-20 h-20 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(249,115,22,0.4)]">
            <Shield className="w-10 h-10 text-black" />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black uppercase tracking-tighter italic">API Key Required</h1>
            <p className="text-zinc-400 leading-relaxed">
              To generate high-quality cinematic videos, you need to select a paid Gemini API key. 
              This ensures the best performance and resolution for your comic creations.
            </p>
          </div>
          <button
            onClick={handleSelectKey}
            className="w-full py-4 bg-white text-black font-bold uppercase tracking-widest hover:bg-orange-500 transition-colors rounded-lg flex items-center justify-center gap-2 group"
          >
            Select API Key
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <p className="text-xs text-zinc-500">
            Don't have a key? <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline hover:text-white">Learn about billing</a>
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500 selection:text-black">
      {/* Background Grid Effect */}
      <div className="fixed inset-0 pointer-events-none opacity-20" 
           style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Column: Content */}
          <div className="space-y-12">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 text-orange-500">
                <Zap className="w-5 h-5 fill-current" />
                <span className="text-xs font-bold uppercase tracking-[0.2em]">Issue #01: Shadow Alliance</span>
              </div>
              <h1 className="text-7xl lg:text-9xl font-black uppercase tracking-tighter leading-[0.85] italic">
                Cinematic <br />
                <span className="text-orange-500">Comics</span>
              </h1>
              <p className="text-xl text-zinc-400 max-w-lg leading-relaxed">
                Transform your stories into dynamic, animated comic book experiences with AI-driven visuals and narration.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 text-zinc-500">
                <Sparkles className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Select Art Style</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {COMIC_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style)}
                    className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
                      selectedStyle.id === style.id 
                        ? 'bg-orange-500 border-orange-500 text-black shadow-[0_0_20px_rgba(249,115,22,0.3)]' 
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    {style.name}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-500 italic">
                {selectedStyle.description}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="space-y-6 bg-zinc-900/30 p-6 rounded-3xl border border-zinc-800/50"
            >
              <div className="flex items-center gap-2 text-zinc-500">
                <Volume2 className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Text & Bubbles</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Font Style</label>
                  <div className="flex flex-wrap gap-2">
                    {TEXT_FONTS.map((font) => (
                      <button
                        key={font.id}
                        onClick={() => setSelectedFont(font)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                          selectedFont.id === font.id 
                            ? 'bg-white border-white text-black' 
                            : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                        }`}
                      >
                        {font.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Bubble Color</label>
                  <div className="flex flex-wrap gap-2">
                    {BUBBLE_COLORS.map((color) => (
                      <button
                        key={color.id}
                        onClick={() => setSelectedBubble(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          selectedBubble.id === color.id 
                            ? 'border-orange-500 scale-110' 
                            : 'border-white/20'
                        }`}
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-3 md:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Animation Effect</label>
                  <div className="flex flex-wrap gap-2">
                    {ANIMATION_EFFECTS.map((anim) => (
                      <button
                        key={anim.id}
                        onClick={() => setSelectedAnim(anim)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                          selectedAnim.id === anim.id 
                            ? 'bg-orange-500 border-orange-500 text-black' 
                            : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                        }`}
                      >
                        {anim.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 text-zinc-500">
                <Mic className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Script & Dialogue</span>
              </div>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Enter your comic script or dialogue here..."
                className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-300 focus:outline-none focus:border-orange-500 transition-colors resize-none placeholder:text-zinc-700"
              />
              <p className="text-[10px] text-zinc-600 italic">
                Gemini will automatically structure your script into a 30-second cinematic experience, suggesting camera angles and pacing.
              </p>
            </motion.div>

            {analysis && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6 bg-orange-500/5 p-6 rounded-3xl border border-orange-500/20"
              >
                <div className="flex items-center gap-2 text-orange-500">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">AI Director's Cut</span>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase text-zinc-600">Narration</p>
                    <p className="text-sm italic text-zinc-300">"{analysis.narration}"</p>
                  </div>
                  
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase text-zinc-600">Scene Breakdown</p>
                    <div className="grid grid-cols-1 gap-3">
                      {analysis.scenes.map((scene, idx) => (
                        <div key={idx} className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-[11px] space-y-2">
                          <div className="flex justify-between items-center border-b border-zinc-900 pb-2 mb-2">
                            <span className="font-bold text-orange-500 uppercase tracking-tighter">Panel {idx + 1}</span>
                            <span className="text-zinc-600 uppercase text-[9px] tracking-widest">{scene.pacing}</span>
                          </div>
                          <p className="text-zinc-400 leading-relaxed">{scene.visual}</p>
                          <div className="flex gap-4 text-zinc-500 font-medium">
                            <span className="flex items-center gap-1"><Film className="w-3 h-3" /> {scene.camera_angle}</span>
                            <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {scene.panel_layout}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap gap-4"
            >
              {!videoUrl && !isGenerating && (
                <button
                  onClick={startGeneration}
                  className="px-8 py-5 bg-orange-500 text-black font-black uppercase tracking-widest hover:bg-white transition-all rounded-full flex items-center gap-3 shadow-[0_10px_40px_rgba(249,115,22,0.3)] active:scale-95"
                >
                  <Sparkles className="w-6 h-6" />
                  Generate Masterpiece
                </button>
              )}
              
              {videoUrl && !isGenerating && (
                <button
                  onClick={startGeneration}
                  className="px-8 py-5 border border-zinc-800 text-white font-bold uppercase tracking-widest hover:bg-zinc-900 transition-all rounded-full flex items-center gap-3"
                >
                  <Sparkles className="w-6 h-6" />
                  Regenerate
                </button>
              )}
            </motion.div>

            {/* Feature List */}
            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-zinc-900">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-zinc-500">
                  <Film className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Visuals</span>
                </div>
                <p className="text-sm font-medium">Veo 3.1 Cinematic Engine</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-zinc-500">
                  <Mic className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Audio</span>
                </div>
                <p className="text-sm font-medium">Gemini TTS Narration</p>
              </div>
            </div>
          </div>

          {/* Right Column: Preview/Player */}
          <div className="relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="aspect-[9/16] bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 relative group"
            >
              <AnimatePresence mode="wait">
                {isGenerating ? (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center space-y-6 bg-black/80 backdrop-blur-sm z-20"
                  >
                    <div className="relative">
                      <Loader2 className="w-16 h-16 text-orange-500 animate-spin" />
                      <div className="absolute inset-0 blur-xl bg-orange-500/20 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold uppercase italic">Creating Magic</h3>
                      <p className="text-zinc-400 text-sm animate-pulse">{progress}</p>
                    </div>
                  </motion.div>
                ) : videoUrl ? (
                  <motion.div 
                    key="video"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full w-full relative"
                  >
                    <video 
                      ref={videoRef}
                      src={videoUrl} 
                      className="h-full w-full object-cover"
                      controls
                      autoPlay
                      loop
                    />
                    <div className="absolute top-6 right-6 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a 
                        href={videoUrl} 
                        download="comic-video.mp4"
                        className="p-3 bg-black/50 backdrop-blur-md rounded-full hover:bg-orange-500 transition-colors"
                        title="Download MP4"
                      >
                        <Download className="w-5 h-5" />
                      </a>
                      {audioUrl && (
                        <a 
                          href={audioUrl} 
                          download="narration.mp3"
                          className="p-3 bg-black/50 backdrop-blur-md rounded-full hover:bg-orange-500 transition-colors"
                          title="Download Narration MP3"
                        >
                          <Volume2 className="w-5 h-5" />
                        </a>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center p-12 text-center space-y-6 bg-zinc-950">
                    <div className="w-24 h-24 rounded-full border-2 border-dashed border-zinc-800 flex items-center justify-center">
                      <Play className="w-8 h-8 text-zinc-700" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Preview Window</h3>
                      <p className="text-zinc-700 text-sm">Your cinematic creation will appear here once generated.</p>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Decorative Elements */}
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-orange-500/10 blur-3xl rounded-full -z-10" />
            <div className="absolute -top-6 -left-6 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full -z-10" />
          </div>
        </div>

        {/* Error Toast */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3 z-50"
            >
              <Shield className="w-5 h-5" />
              <span className="text-sm font-bold">{error}</span>
              <button onClick={() => setError(null)} className="ml-2 hover:opacity-70">✕</button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-black fill-current" />
            </div>
            <div>
              <p className="font-black uppercase tracking-tighter italic">Shadow Alliance</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Powered by Gemini & Veo</p>
            </div>
          </div>
          <div className="flex gap-8 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            <a href="#" className="hover:text-white transition-colors">Documentation</a>
            <a href="#" className="hover:text-white transition-colors">API Status</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
