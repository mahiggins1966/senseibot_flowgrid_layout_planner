import { useEffect, useRef } from 'react';
import { useGridStore } from '../store/gridStore';

export function useGestures(svgRef: React.RefObject<SVGSVGElement>) {
  const gestureStateRef = useRef({
    isPanning: false,
    lastPanX: 0,
    lastPanY: 0,
    spaceHeld: false,
  });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    // --- Keyboard: track spacebar for space+drag panning ---
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        // Don't hijack space if user is typing in an input
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        gestureStateRef.current.spaceHeld = true;
        svg.style.cursor = 'grab';
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        gestureStateRef.current.spaceHeld = false;
        if (!gestureStateRef.current.isPanning) {
          svg.style.cursor = '';
        }
      }
    };

    // --- Wheel: Ctrl/Cmd+scroll = zoom, plain scroll = pan ---
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const vp = useGridStore.getState().viewport;

      if (e.ctrlKey || e.metaKey) {
        // Zoom (also handles trackpad pinch which sends ctrlKey)
        const rect = svg.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.min(Math.max(vp.zoom * zoomFactor, 0.1), 5);

        const svgX = (mouseX - vp.panX) / vp.zoom;
        const svgY = (mouseY - vp.panY) / vp.zoom;

        useGridStore.getState().setZoom(
          newZoom,
          mouseX - svgX * newZoom,
          mouseY - svgY * newZoom
        );
      } else {
        // Pan: vertical scroll = vertical pan, shift+scroll = horizontal pan
        const dx = e.shiftKey ? -e.deltaY : -e.deltaX;
        const dy = e.shiftKey ? 0 : -e.deltaY;

        useGridStore.getState().setPan(vp.panX + dx, vp.panY + dy);
      }
    };

    // --- Mouse: space+left drag, middle mouse drag, or Ctrl+left drag ---
    const handleMouseDown = (e: MouseEvent) => {
      const shouldPan =
        (e.button === 0 && gestureStateRef.current.spaceHeld) ||  // Space + left click
        (e.button === 1) ||                                        // Middle mouse
        (e.button === 0 && (e.ctrlKey || e.metaKey || e.shiftKey)); // Ctrl/Shift + left (legacy)

      if (shouldPan) {
        e.preventDefault();
        gestureStateRef.current.isPanning = true;
        gestureStateRef.current.lastPanX = e.clientX;
        gestureStateRef.current.lastPanY = e.clientY;
        svg.style.cursor = 'grabbing';
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!gestureStateRef.current.isPanning) return;

      // Safety: if no buttons held, stop panning
      if (e.buttons === 0) {
        gestureStateRef.current.isPanning = false;
        svg.style.cursor = gestureStateRef.current.spaceHeld ? 'grab' : '';
        return;
      }

      const deltaX = e.clientX - gestureStateRef.current.lastPanX;
      const deltaY = e.clientY - gestureStateRef.current.lastPanY;

      const vp = useGridStore.getState().viewport;
      useGridStore.getState().setPan(vp.panX + deltaX, vp.panY + deltaY);

      gestureStateRef.current.lastPanX = e.clientX;
      gestureStateRef.current.lastPanY = e.clientY;
    };

    const handleMouseUp = () => {
      gestureStateRef.current.isPanning = false;
      svg.style.cursor = gestureStateRef.current.spaceHeld ? 'grab' : '';
    };

    // Prevent default middle-click auto-scroll
    const handleAuxClick = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    svg.addEventListener('mousedown', handleMouseDown);
    svg.addEventListener('auxclick', handleAuxClick);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      svg.removeEventListener('wheel', handleWheel);
      svg.removeEventListener('mousedown', handleMouseDown);
      svg.removeEventListener('auxclick', handleAuxClick);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []); // No dependencies - reads from store directly to avoid stale closures
}
