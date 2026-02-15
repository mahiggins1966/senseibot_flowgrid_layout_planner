import { useEffect, useRef } from 'react';
import { useGridStore } from '../store/gridStore';

export function useGestures(svgRef: React.RefObject<SVGSVGElement>) {
  const { viewport, setZoom, setPan } = useGridStore();
  const gestureStateRef = useRef({
    isPanning: false,
    lastPanX: 0,
    lastPanY: 0,
  });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = viewport.zoom * zoomFactor;

      const svgX = (mouseX - viewport.panX) / viewport.zoom;
      const svgY = (mouseY - viewport.panY) / viewport.zoom;

      setZoom(
        newZoom,
        mouseX - svgX * newZoom,
        mouseY - svgY * newZoom
      );
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && (e.shiftKey || e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        gestureStateRef.current.isPanning = true;
        gestureStateRef.current.lastPanX = e.clientX;
        gestureStateRef.current.lastPanY = e.clientY;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (gestureStateRef.current.isPanning) {
        const deltaX = e.clientX - gestureStateRef.current.lastPanX;
        const deltaY = e.clientY - gestureStateRef.current.lastPanY;

        setPan(
          viewport.panX + deltaX,
          viewport.panY + deltaY
        );

        gestureStateRef.current.lastPanX = e.clientX;
        gestureStateRef.current.lastPanY = e.clientY;
      }
    };

    const handleMouseUp = () => {
      gestureStateRef.current.isPanning = false;
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    svg.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      svg.removeEventListener('wheel', handleWheel);
      svg.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [viewport, setZoom, setPan]);
}
