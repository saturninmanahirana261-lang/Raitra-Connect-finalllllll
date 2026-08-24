import React, { useState, useRef, useEffect } from 'react';
import {
  Pencil,
  Square,
  Circle,
  Type,
  Eraser,
  Download,
  Trash2,
  Undo2,
  X,
  Palette,
  Minus,
  Sparkles
} from 'lucide-react';
import { rtdb, ref, push, set, onValue, remove } from '../firebase';
import type { WhiteboardStroke } from '../types';

interface WhiteboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId?: string;
  userName?: string;
}

const COLORS = [
  '#000000',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#ffffff'
];

const STROKE_WIDTHS = [2, 4, 8, 14];

export const WhiteboardModal: React.FC<WhiteboardModalProps> = ({
  isOpen,
  onClose,
  roomId = 'general-whiteboard',
  userName = 'Membre'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<'pencil' | 'line' | 'rect' | 'circle' | 'text' | 'eraser'>('pencil');
  const [color, setColor] = useState<string>('#3b82f6');
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [textInput, setTextInput] = useState<{ x: number; y: number; value: string } | null>(null);

  // Sync with Firebase RTDB
  useEffect(() => {
    if (!isOpen) return;

    const boardRef = ref(rtdb, `whiteboards/${roomId}/strokes`);
    const unsub = onValue(boardRef, (snapshot) => {
      if (snapshot.exists()) {
        const loaded: WhiteboardStroke[] = [];
        snapshot.forEach((child) => {
          loaded.push({ id: child.key as string, ...child.val() });
        });
        setStrokes(loaded);
      } else {
        setStrokes([]);
      }
    });

    return () => unsub();
  }, [isOpen, roomId]);

  // Redraw canvas whenever strokes change
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background grid
    drawGrid(ctx, canvas.width, canvas.height);

    // Draw all strokes
    strokes.forEach((stroke) => {
      drawStroke(ctx, stroke);
    });

    // Draw current active stroke if in progress
    if (isDrawing && currentPoints.length > 0) {
      drawActiveStroke(ctx, {
        id: 'temp',
        type: tool,
        points: currentPoints,
        color: tool === 'eraser' ? '#ffffff' : color,
        width: strokeWidth
      });
    }
  }, [strokes, isDrawing, currentPoints, tool, color, strokeWidth, isOpen]);

  // Handle canvas resize
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [isOpen]);

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    const gridSize = 28;

    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: WhiteboardStroke) => {
    if (!stroke.points || stroke.points.length === 0) return;

    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.type === 'pencil' || stroke.type === 'eraser') {
      if (stroke.type === 'eraser') {
        ctx.strokeStyle = '#ffffff';
      }
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    } else if (stroke.type === 'line' && stroke.points.length >= 2) {
      const p1 = stroke.points[0];
      const p2 = stroke.points[stroke.points.length - 1];
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    } else if (stroke.type === 'rect' && stroke.points.length >= 2) {
      const p1 = stroke.points[0];
      const p2 = stroke.points[stroke.points.length - 1];
      ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
    } else if (stroke.type === 'circle' && stroke.points.length >= 2) {
      const p1 = stroke.points[0];
      const p2 = stroke.points[stroke.points.length - 1];
      const radius = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (stroke.type === 'text' && stroke.text && stroke.points.length > 0) {
      ctx.font = `${stroke.width * 4 + 12}px sans-serif`;
      ctx.fillText(stroke.text, stroke.points[0].x, stroke.points[0].y);
    }

    ctx.restore();
  };

  const drawActiveStroke = (ctx: CanvasRenderingContext2D, stroke: WhiteboardStroke) => {
    drawStroke(ctx, stroke);
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    if (tool === 'text') {
      setTextInput({ x: coords.x, y: coords.y, value: '' });
      return;
    }
    setIsDrawing(true);
    setCurrentPoints([coords]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const coords = getCanvasCoords(e);
    if (tool === 'pencil' || tool === 'eraser') {
      setCurrentPoints((prev) => [...prev, coords]);
    } else {
      // For shapes: keep start point + current mouse point
      setCurrentPoints((prev) => [prev[0], coords]);
    }
  };

  const handleMouseUp = async () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPoints.length > 0) {
      const newStroke: Omit<WhiteboardStroke, 'id'> = {
        type: tool,
        points: currentPoints,
        color: tool === 'eraser' ? '#ffffff' : color,
        width: strokeWidth,
        userId: userName,
        timestamp: Date.now()
      };

      const boardRef = ref(rtdb, `whiteboards/${roomId}/strokes`);
      const newStrokeRef = push(boardRef);
      await set(newStrokeRef, newStroke).catch(console.warn);
    }
    setCurrentPoints([]);
  };

  const handleTextSubmit = async () => {
    if (textInput && textInput.value.trim()) {
      const newStroke: Omit<WhiteboardStroke, 'id'> = {
        type: 'text',
        points: [{ x: textInput.x, y: textInput.y }],
        color,
        width: strokeWidth,
        text: textInput.value.trim(),
        userId: userName,
        timestamp: Date.now()
      };
      const boardRef = ref(rtdb, `whiteboards/${roomId}/strokes`);
      const newStrokeRef = push(boardRef);
      await set(newStrokeRef, newStroke).catch(console.warn);
    }
    setTextInput(null);
  };

  const handleUndo = async () => {
    if (strokes.length === 0) return;
    const lastStroke = strokes[strokes.length - 1];
    if (lastStroke.id) {
      await remove(ref(rtdb, `whiteboards/${roomId}/strokes/${lastStroke.id}`)).catch(console.warn);
    }
  };

  const handleClear = async () => {
    if (window.confirm('Voulez-vous vraiment effacer l\'ensemble du tableau blanc ?')) {
      await remove(ref(rtdb, `whiteboards/${roomId}/strokes`)).catch(console.warn);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create a white background canvas for download
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const expCtx = exportCanvas.getContext('2d');
    if (!expCtx) return;

    expCtx.fillStyle = '#ffffff';
    expCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    drawGrid(expCtx, exportCanvas.width, exportCanvas.height);

    strokes.forEach((stroke) => {
      drawStroke(expCtx, stroke);
    });

    const link = document.createElement('a');
    link.download = `tableau-blanc-${roomId}-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md select-none animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-base flex items-center gap-2">
                Tableau Blanc Collaboratif
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-medium">
                  Temps Réel
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Espace partagé pour brainstormer, dessiner et schématiser en réunion.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={strokes.length === 0}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer"
              title="Annuler le dernier trait"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
              title="Tout effacer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-1.5 shadow-md shadow-indigo-600/20 text-xs px-3 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Exporter PNG</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Canvas Container */}
        <div className="relative flex-1 flex bg-slate-100 dark:bg-slate-950 overflow-hidden">
          {/* Floating Left Toolbar */}
          <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 p-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
            {/* Tool Selection */}
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setTool('pencil')}
                className={`p-2.5 rounded-xl transition cursor-pointer ${
                  tool === 'pencil'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Crayon libre"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTool('line')}
                className={`p-2.5 rounded-xl transition cursor-pointer ${
                  tool === 'line'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Ligne droite"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTool('rect')}
                className={`p-2.5 rounded-xl transition cursor-pointer ${
                  tool === 'rect'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Rectangle"
              >
                <Square className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTool('circle')}
                className={`p-2.5 rounded-xl transition cursor-pointer ${
                  tool === 'circle'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Cercle"
              >
                <Circle className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTool('text')}
                className={`p-2.5 rounded-xl transition cursor-pointer ${
                  tool === 'text'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Texte"
              >
                <Type className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTool('eraser')}
                className={`p-2.5 rounded-xl transition cursor-pointer ${
                  tool === 'eraser'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Gomme"
              >
                <Eraser className="w-4 h-4" />
              </button>
            </div>

            <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />

            {/* Stroke Width */}
            <div className="flex flex-col gap-1 items-center">
              {STROKE_WIDTHS.map((sw) => (
                <button
                  key={sw}
                  type="button"
                  onClick={() => setStrokeWidth(sw)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer ${
                    strokeWidth === sw
                      ? 'bg-slate-200 dark:bg-slate-700'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title={`Épaisseur ${sw}px`}
                >
                  <div
                    className="rounded-full bg-slate-700 dark:bg-slate-200"
                    style={{ width: sw, height: sw }}
                  />
                </button>
              ))}
            </div>

            <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />

            {/* Palette */}
            <div className="grid grid-cols-2 gap-1 max-w-[56px]">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setColor(c);
                    if (tool === 'eraser') setTool('pencil');
                  }}
                  className={`w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 transition cursor-pointer ${
                    color === c && tool !== 'eraser' ? 'ring-2 ring-indigo-500 scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Canvas Area */}
          <div className="relative w-full h-full cursor-crosshair">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="w-full h-full block bg-white dark:bg-slate-900"
            />

            {/* In-place Text Input */}
            {textInput && (
              <div
                className="absolute z-30 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-2xl border border-indigo-500 flex items-center gap-2"
                style={{ top: textInput.y, left: textInput.x }}
              >
                <input
                  type="text"
                  autoFocus
                  placeholder="Écrire votre note..."
                  value={textInput.value}
                  onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTextSubmit();
                    if (e.key === 'Escape') setTextInput(null);
                  }}
                  className="px-2.5 py-1 text-sm bg-transparent border-none outline-none text-slate-800 dark:text-white min-w-[200px]"
                />
                <button
                  type="button"
                  onClick={handleTextSubmit}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 cursor-pointer"
                >
                  OK
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
