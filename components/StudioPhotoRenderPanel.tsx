import React, { useState, useRef } from "react";
import { Sparkles, X, Upload, Download } from "lucide-react";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { Textarea } from "./Textarea";
import { usePhotoRender } from "../helpers/usePhotoRender";
import styles from "./StudioPhotoRenderPanel.module.css";

interface StudioPhotoRenderPanelProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  shapeType: string;
  width: number;
  height: number;
  depth: number;
  exteriorColor: string;
  interiorColor: string;
  materialType: string;
  className?: string;
}

export const StudioPhotoRenderPanel: React.FC<StudioPhotoRenderPanelProps> = ({
  canvasRef,
  shapeType,
  width,
  height,
  depth,
  exteriorColor,
  interiorColor,
  materialType,
  className,
}) => {
  const [prompt, setPrompt] = useState("");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutate, isPending, error } = usePhotoRender();

  const handleGenerate = () => {
    if (!canvasRef.current) return;

    try {
      // Capture the WebGL canvas as a data URL
      const canvasImageBase64 = canvasRef.current.toDataURL("image/png");

      mutate(
        {
          canvasImageBase64,
          prompt: prompt.trim() || undefined,
          shapeType,
          width,
          height,
          depth,
          exteriorColor,
          interiorColor,
          materialType,
          referenceImageBase64: referenceImage,
        },
        {
          onSuccess: (data) => {
            setGeneratedImage(data.imageBase64);
          },
        }
      );
    } catch (e) {
      console.error("Failed to capture canvas image:", e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === "string") {
        setReferenceImage(event.target.result);
      }
    };
    reader.readAsDataURL(file);
    
    // Reset input value to allow selecting the same file again if cleared
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const clearReference = () => {
    setReferenceImage(null);
  };

  const clearGeneratedImage = () => {
    setGeneratedImage(null);
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${generatedImage}`;
    link.download = "render.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`${styles.container} ${className || ""}`}>
      <div className={styles.header}>
        <span className={styles.title}>Render</span>
        <div className={styles.headerRight}>
          {generatedImage && (
            <button
              className={styles.headerDownloadBtn}
              onClick={handleDownload}
              aria-label="Download generated image"
            >
              <Download size={14} />
            </button>
          )}
          <Button
            onClick={handleGenerate}
            disabled={isPending}
            size="sm"
            className={styles.generateButton}
          >
            <Sparkles className={styles.icon} size={14} /> Generate
          </Button>
                </div>
      </div>

      <div className={styles.imageArea}>
        {isPending && (
          <div className={styles.loadingState}>
            <Spinner size="lg" />
            <span className={styles.loadingText}>Generating...</span>
          </div>
        )}

        {!isPending && generatedImage && (
          <div className={styles.resultWrapper}>
            <img
              src={`data:image/png;base64,${generatedImage}`}
              className={styles.image}
              alt="Generated packaging render"
            />
            <Button
              variant="outline"
              size="icon-sm"
              onClick={clearGeneratedImage}
              className={styles.clearImageBtn}
              aria-label="Clear generated image"
            >
              <X size={14} />
            </Button>
          </div>
        )}

        {!isPending && !generatedImage && error && (
          <div className={styles.errorState}>
            {error instanceof Error ? error.message : "An unknown error occurred"}
          </div>
        )}

        {!isPending && !generatedImage && !error && (
          <div className={styles.emptyState}>
            Click Generate to create a photorealistic render
          </div>
        )}
      </div>

      <div className={styles.controls}>
        <div className={styles.promptGroup}>
          <label className={styles.label} htmlFor="render-prompt">
            Additional Instructions
          </label>
          <Textarea
            id="render-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. on a wooden table with dramatic lighting"
            className={styles.textarea}
            disableResize
          />
        </div>

        <div className={styles.referenceGroup}>
          <label className={styles.label}>Reference Photo (Optional)</label>
          {referenceImage ? (
            <div className={styles.referencePreview}>
              <img
                src={referenceImage}
                alt="Reference"
                className={styles.referenceImg}
              />
              <div className={styles.referenceInfo}>
                <span className={styles.referenceText}>Image attached</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearReference}
                  className={styles.clearRefBtn}
                >
                  <X size={14} /> Remove
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.uploadWrapper}>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className={styles.uploadBtn}
              >
                <Upload size={16} /> Add Reference
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className={styles.hiddenInput}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};