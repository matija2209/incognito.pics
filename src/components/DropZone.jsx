import { useState, useCallback } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForm } from '@tanstack/react-form';

export function DropZone({ onFileSelect, className }) {
  const [isDragging, setIsDragging] = useState(false);

  const form = useForm({
    defaultValues: {
      file: null,
    },
    onSubmit: async ({ value }) => {
      if (value.file) {
        onFileSelect(value.file);
      }
    },
  });

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <form.Field
      name="file"
      validators={{
        onChange: ({ value }) => {
          if (value && !['image/jpeg', 'image/png', 'image/webp'].includes(value.type)) {
            return 'Unsupported file format. Please use JPEG, PNG, or WebP.';
          }
          return undefined;
        },
      }}
      children={(field) => (
        <div className="flex flex-col items-center gap-2">
          <div
            className={cn(
              "relative group cursor-pointer border-2 border-dashed rounded-xl transition-all duration-200 ease-in-out p-12 flex flex-col items-center justify-center text-center w-full",
              isDragging 
                ? "border-primary bg-primary/5 scale-[1.01]" 
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
              field.state.meta.errors.length > 0 && "border-destructive bg-destructive/5",
              className
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const files = e.dataTransfer.files;
              if (files && files.length > 0) {
                field.handleChange(files[0]);
                if (['image/jpeg', 'image/png', 'image/webp'].includes(files[0].type)) {
                  form.handleSubmit();
                }
              }
            }}
            onClick={() => document.getElementById('file-input').click()}
          >
            <input
              id="file-input"
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  field.handleChange(files[0]);
                  if (['image/jpeg', 'image/png', 'image/webp'].includes(files[0].type)) {
                    form.handleSubmit();
                  }
                }
              }}
            />
            
            <div className={cn(
              "bg-primary/10 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform",
              field.state.meta.errors.length > 0 && "bg-destructive/10"
            )}>
              <Upload className={cn(
                "w-8 h-8 text-primary",
                field.state.meta.errors.length > 0 && "text-destructive"
              )} />
            </div>
            
            <h3 className="text-xl font-semibold mb-2">Drop your image here</h3>
            <p className="text-muted-foreground max-w-xs">
              Supports JPEG, PNG, and WebP. 
              Metadata will be stripped locally.
            </p>
            
            <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground/60">
              <ImageIcon className="w-4 h-4" />
              <span>No server uploads • 100% private</span>
            </div>
          </div>
          {field.state.meta.errors.length > 0 && (
            <p className="text-destructive text-sm font-medium animate-in fade-in slide-in-from-top-1">
              {field.state.meta.errors.join(', ')}
            </p>
          )}
        </div>
      )}
    />
  );
}
