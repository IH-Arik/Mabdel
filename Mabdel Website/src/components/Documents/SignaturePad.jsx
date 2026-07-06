import { useRef, useState, useEffect } from 'react';
import { Eraser } from 'lucide-react';

export default function SignaturePad({ onSave }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      // Set actual size in memory (scaled to account for extra pixel density if needed, though simple 1:1 is fine here)
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#11C7E5'; // Cyan ink
    }
  }, []);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    setIsEmpty(false);
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (!isEmpty) {
      onSave(canvasRef.current.toDataURL());
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onSave(null);
  };

  return (
    <div className="relative border-2 border-dashed border-slate-700 rounded-2xl overflow-hidden bg-[#070a13]">
      <canvas
        ref={canvasRef}
        width={400}
        height={200}
        className="w-full h-48 cursor-crosshair touch-none"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={endDrawing}
      />
      {!isEmpty && (
        <button 
          onClick={clear}
          className="absolute top-2 right-2 p-2 bg-slate-900/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold backdrop-blur"
        >
          <Eraser size={14} /> Clear
        </button>
      )}
      {isEmpty && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-600 font-medium">
          Sign here
        </div>
      )}
    </div>
  );
}
