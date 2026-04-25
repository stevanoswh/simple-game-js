'use client';
import { useRef, useState, useEffect, ChangeEvent, PointerEvent } from 'react';

type ToolMode = 'erase' | 'draw';

interface WireframeProps {
  uploadedImage?: string | null;
  selectedColor?: string;
  mode?: ToolMode;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export default function Wireframe({
  uploadedImage: controlledUploadedImage,
  selectedColor = '#000000',
  mode = 'erase',
}: WireframeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [localUploadedImage, setLocalUploadedImage] = useState<string | null>(null);
  const [eraserSize, setEraserSize] = useState<number>(20);
  const isDrawingRef = useRef<boolean>(false);
  const uploadedImage =
    controlledUploadedImage === undefined ? localUploadedImage : controlledUploadedImage;
  const isControlledUpload = controlledUploadedImage !== undefined;

  // Handle image upload
  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setLocalUploadedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Initialize canvas and draw image when uploadedImage changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!uploadedImage) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = uploadedImage;
  }, [uploadedImage]);

  const getContext = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    return canvas.getContext('2d');
  };

  const getCanvasCoordinates = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const configureBrush = (context: CanvasRenderingContext2D) => {
    context.globalCompositeOperation = mode === 'erase' ? 'destination-out' : 'source-over';
    context.lineWidth = eraserSize;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    if (mode === 'draw') {
      context.strokeStyle = selectedColor;
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const context = getContext();
    if (!context) return;

    const { x, y } = getCanvasCoordinates(event);
    isDrawingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);

    configureBrush(context);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x, y);
    context.stroke();
    context.beginPath();
    context.moveTo(x, y);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;

    const context = getContext();
    if (!context) return;

    const { x, y } = getCanvasCoordinates(event);
    configureBrush(context);
    context.lineTo(x, y);
    context.stroke();
    context.beginPath();
    context.moveTo(x, y);
  };

  const stopPainting = (event?: PointerEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = false;

    const context = getContext();
    context?.beginPath();

    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const canvasContainerStyle =
    mode === 'erase'
      ? {
          marginTop: '1rem',
          display: 'inline-block',
          border: '1px solid #ccc',
          backgroundColor: '#ffffff',
          backgroundImage:
            'linear-gradient(45deg, #d1d5db 25%, transparent 25%), linear-gradient(-45deg, #d1d5db 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d1d5db 75%), linear-gradient(-45deg, transparent 75%, #d1d5db 75%)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
          lineHeight: 0,
        }
      : {
          marginTop: '1rem',
          display: 'inline-block',
          border: '1px solid #ccc',
          backgroundColor: '#ffffff',
          lineHeight: 0,
        };

  return (
    <div>
      {!isControlledUpload && (
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ marginBottom: '1rem' }}
        />
      )}
      <div>
        <label>
          {mode === 'draw' ? 'Brush Size:' : 'Eraser Size:'}
          <input
            type="range"
            min="5"
            max="100"
            value={eraserSize}
            onChange={(e) => setEraserSize(Number(e.target.value))}
          />
        </label>
      </div>
      <div style={canvasContainerStyle}>
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopPainting}
          onPointerLeave={stopPainting}
          style={{ display: 'block', touchAction: 'none' }}
        />
      </div>
    </div>
  );
}
