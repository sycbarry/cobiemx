import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";

function PopoutPortal({ anchorRef, children, show }: { anchorRef: React.RefObject<HTMLButtonElement | null>, children: React.ReactNode, show: boolean }) {
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (show && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.top, left: rect.right + 16 });
    }
  }, [show, anchorRef]);
  if (!show) return null;
  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, boxShadow: 'none !important' }} className="bg-white border border-gray-200 w-56 max-h-64 overflow-auto" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
      {children}
    </div>,
    document.body
  );
}

export default PopoutPortal; 