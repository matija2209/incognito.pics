import React from 'react';

export function ImagePreview({ originalUrl, cleanedUrl }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl mx-auto">
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Original</h4>
        <div className="aspect-square bg-muted rounded-xl overflow-hidden border flex items-center justify-center">
          {originalUrl ? (
            <img 
              src={originalUrl} 
              alt="Original" 
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-muted-foreground/40 italic">No image selected</div>
          )}
        </div>
      </div>
      
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Cleaned</h4>
        <div className="aspect-square bg-muted rounded-xl overflow-hidden border flex items-center justify-center">
          {cleanedUrl ? (
            <img 
              src={cleanedUrl} 
              alt="Cleaned" 
              className="w-full h-full object-contain animate-in fade-in duration-500"
            />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <div className="text-muted-foreground/40 italic">Processing...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
