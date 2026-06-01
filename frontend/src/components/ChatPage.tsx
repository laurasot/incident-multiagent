import { useState, useRef, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { ChatContainer } from './ChatContainer';

interface ChatPageProps {
  signOut: () => void
  user: any
}

export function ChatPage({ signOut, user }: ChatPageProps) {
  const [sidebarWidth, setSidebarWidth] = useState(320); // Initial width in pixels (w-80 = 320px)
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const startResizing = () => {
    setIsResizing(true);
  };

  const stopResizing = () => {
    setIsResizing(false);
  };

  const resize = (e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX;
      // Clamp width between 200px and 600px
      if (newWidth >= 200 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    }
  };

  useEffect(() => {
    const handleResize = (e: MouseEvent) => resize(e);
    const handleStopResize = () => stopResizing();

    if (isResizing) {
      window.addEventListener('mousemove', handleResize);
      window.addEventListener('mouseup', handleStopResize);
    }

    return () => {
      window.removeEventListener('mousemove', handleResize);
      window.removeEventListener('mouseup', handleStopResize);
    };
  }, [isResizing]);

  return (
    <div className="h-screen bg-[#0c0e16] flex flex-col" style={{ userSelect: isResizing ? 'none' : 'auto' }}>
      {/* Header - Fixed at top */}
      <header className="flex-shrink-0 bg-[#0f1119] border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-center justify-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-[#e2e5f0]">
            Juanin, Analista de Incidentes
          </h1>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-[#6b7af8]/50 to-transparent mt-3 mx-auto max-w-xs" />
      </header>

      {/* Main Content - Takes remaining height */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <div ref={sidebarRef} style={{ width: `${sidebarWidth}px` }}>
          <Sidebar signOut={signOut} />
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={startResizing}
          className="w-px bg-white/[0.06] hover:bg-[#6b7af8]/50 cursor-col-resize transition-colors duration-200 flex-shrink-0"
        />

        <div className="flex-1 min-w-0 flex flex-col h-full">
          <ChatContainer user={user} />
        </div>
      </div>
    </div>
  );
}
