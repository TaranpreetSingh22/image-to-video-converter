import { useState, useEffect, useRef } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import { message } from "antd";

export const useFFmpeg = () => {
  const [isFfmpegLoaded, setIsFfmpegLoaded] = useState(false);

  // 1. Use lazy state initialization instead of useRef for the instance
  const [ffmpeg] = useState(() => new FFmpeg());

  const isLoadingRef = useRef(false);

  useEffect(() => {
    if (isLoadingRef.current || isFfmpegLoaded) return;

    const loadFFmpeg = async () => {
      isLoadingRef.current = true;

      try {
        // 2. We can now use 'ffmpeg' directly without '.current'
        await ffmpeg.load({
          coreURL: await toBlobURL(`/ffmpeg/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(
            `/ffmpeg/ffmpeg-core.wasm`,
            "application/wasm",
          ),
        });

        setIsFfmpegLoaded(true);
        message.success("FFmpeg loaded successfully. Ready to convert!");
      } catch (error) {
        console.error("Error loading FFmpeg:", error);
        message.error(
          "Failed to load FFmpeg. Please check your network headers.",
        );
        isLoadingRef.current = false;
      }
    };

    loadFFmpeg();
  }, [ffmpeg, isFfmpegLoaded]);

  return {
    ffmpeg, // 3. Return the state instance directly to avoid the React error
    isFfmpegLoaded,
  };
};
