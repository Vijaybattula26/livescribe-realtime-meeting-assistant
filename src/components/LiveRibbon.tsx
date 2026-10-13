import React, { useRef, useEffect } from 'react';
import { LiveConnectionStatus } from '../types';

interface LiveRibbonProps {
  status: LiveConnectionStatus;
  micLevel: number;
}

export const LiveRibbon: React.FC<LiveRibbonProps> = ({ status, micLevel }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const wakeUpStartRef = useRef<number | null>(null);
  const prevStatusRef = useRef<LiveConnectionStatus>(status);
  const phaseRef = useRef<number>(0);
  const smoothedLevelRef = useRef<number>(0);
  const isReducedMotionRef = useRef<boolean>(false);

  useEffect(() => {
    isReducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Track status transitions for 600ms waking up animation
  useEffect(() => {
    if (status === 'live' && prevStatusRef.current !== 'live') {
      wakeUpStartRef.current = performance.now();
    }
    prevStatusRef.current = status;
  }, [status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isRunning = true;
    let lastTimestamp = performance.now();

    const handleVisibility = () => {
      if (document.hidden) {
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
      } else {
        lastTimestamp = performance.now();
        renderLoop(performance.now());
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    const renderLoop = (timestamp: number) => {
      if (!isRunning) return;

      // Cap at ~60fps
      const elapsed = timestamp - lastTimestamp;
      if (elapsed < 15) {
        animFrameRef.current = requestAnimationFrame(renderLoop);
        return;
      }
      lastTimestamp = timestamp;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;

      if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, displayWidth, displayHeight);

      const midY = displayHeight / 2;
      const isDark = document.documentElement.classList.contains('dark');

      // Theme Colors
      const cobalt = isDark ? '#7C98FF' : '#2B59FF';
      const ink3 = isDark ? '#60738C' : '#DCE2EA';
      const amber = isDark ? '#F2B84B' : '#9A5B00';

      // Reduced motion fallback: static level bar
      if (isReducedMotionRef.current) {
        ctx.beginPath();
        ctx.strokeStyle = status === 'error' ? amber : status === 'live' ? cobalt : ink3;
        ctx.lineWidth = 2;
        ctx.moveTo(0, midY);
        ctx.lineTo(displayWidth, midY);
        ctx.stroke();

        if (status === 'live' && micLevel > 0.05) {
          const barWidth = Math.min(displayWidth * 0.8, displayWidth * (0.1 + micLevel * 0.7));
          ctx.beginPath();
          ctx.strokeStyle = cobalt;
          ctx.lineWidth = 4;
          ctx.moveTo((displayWidth - barWidth) / 2, midY);
          ctx.lineTo((displayWidth + barWidth) / 2, midY);
          ctx.stroke();
        }

        ctx.restore();
        animFrameRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      // Smooth microphone amplitude tracking
      const targetLevel = status === 'live' ? Math.max(0.04, micLevel) : 0;
      smoothedLevelRef.current += (targetLevel - smoothedLevelRef.current) * 0.18;

      // Compute wake-up envelope (600ms ease-out)
      let wakeUpMultiplier = 1;
      if (status === 'live' && wakeUpStartRef.current !== null) {
        const timeSinceWake = timestamp - wakeUpStartRef.current;
        if (timeSinceWake < 600) {
          const progress = timeSinceWake / 600;
          wakeUpMultiplier = 1 - Math.pow(1 - progress, 3);
        } else {
          wakeUpStartRef.current = null;
        }
      }

      // Advance wave phase (frozen when paused)
      if (status === 'live') {
        phaseRef.current += 0.035;
      }

      // 1. Idle state: flat thin line in ink-3
      if (status === 'idle') {
        ctx.beginPath();
        ctx.strokeStyle = ink3;
        ctx.lineWidth = 1.5;
        ctx.moveTo(0, midY);
        ctx.lineTo(displayWidth, midY);
        ctx.stroke();
        ctx.restore();
        animFrameRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      // 2. Error state: flat line in amber
      if (status === 'error') {
        ctx.beginPath();
        ctx.strokeStyle = amber;
        ctx.lineWidth = 2;
        ctx.moveTo(0, midY);
        ctx.lineTo(displayWidth, midY);
        ctx.stroke();
        ctx.restore();
        animFrameRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      // 3. Listening / Paused waves
      const amplitude = smoothedLevelRef.current * (displayHeight * 0.42) * wakeUpMultiplier;
      const opacityMultiplier = status === 'paused' ? 0.4 : 1.0;

      // Layer 1: Ambient soft background wave
      ctx.beginPath();
      ctx.strokeStyle = cobalt;
      ctx.globalAlpha = 0.22 * opacityMultiplier;
      ctx.lineWidth = 1.5;
      for (let x = 0; x <= displayWidth; x += 4) {
        const normalizedX = x / displayWidth;
        const taper = Math.sin(normalizedX * Math.PI); // Smooth taper at edges
        const y =
          midY +
          Math.sin(x * 0.015 + phaseRef.current * 0.8 + 2.0) * amplitude * 0.6 * taper +
          Math.cos(x * 0.025 - phaseRef.current * 0.5) * amplitude * 0.3 * taper;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Layer 2: Secondary harmonic wave
      ctx.beginPath();
      ctx.strokeStyle = cobalt;
      ctx.globalAlpha = 0.45 * opacityMultiplier;
      ctx.lineWidth = 2;
      for (let x = 0; x <= displayWidth; x += 3) {
        const normalizedX = x / displayWidth;
        const taper = Math.sin(normalizedX * Math.PI);
        const y =
          midY +
          Math.sin(x * 0.022 - phaseRef.current * 1.2 + 0.8) * amplitude * 0.75 * taper;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Layer 3: Primary crisp wave
      ctx.beginPath();
      ctx.strokeStyle = cobalt;
      ctx.globalAlpha = 0.9 * opacityMultiplier;
      ctx.lineWidth = 2.2;
      for (let x = 0; x <= displayWidth; x += 2) {
        const normalizedX = x / displayWidth;
        const taper = Math.sin(normalizedX * Math.PI);
        const y =
          midY +
          Math.sin(x * 0.018 + phaseRef.current) * amplitude * taper;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      isRunning = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [status, micLevel]);

  return (
    <div
      aria-hidden="true"
      className="w-full h-[72px] relative flex items-center justify-center overflow-hidden border-b border-[var(--line)] bg-[var(--surface-2)]/40 transition-colors select-none"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};
