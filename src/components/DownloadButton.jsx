import React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DownloadButton({ blob, filename }) {
  const handleDownload = () => {
    if (!blob) return;
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stripped-${filename}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Button 
      size="lg" 
      onClick={handleDownload} 
      className="gap-2 px-8 font-semibold rounded-full shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
    >
      <Download className="w-5 h-5" />
      Download Cleaned Image
    </Button>
  );
}
