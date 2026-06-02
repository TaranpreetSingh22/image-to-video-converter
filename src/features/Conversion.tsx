import { useState } from "react";
import { fetchFile } from "@ffmpeg/util";
import {
  Button,
  Card,
  List,
  message,
  Typography,
  Popconfirm,
  Space,
} from "antd";
import { PlayCircleOutlined, DeleteOutlined } from "@ant-design/icons";

import { useFFmpeg } from "../hooks/useFFmpeg";
import { Uploader } from "../components/Uploader";
import { QueueItem } from "../components/QueueItem";
import type { ImageItem } from "../types";
import {
  ALLOWED_IMAGE_TYPES,
  DEFAULT_VIDEO_DURATION,
  DEFAULT_FRAMERATE,
} from "../common/constants";
import { getImageDimensions } from "../utils/image";

// 1. Import your new Zustand store
import { useConversionStore } from "../store/useConversionStore";

const { Title, Text } = Typography;

export const Conversion = () => {
  // 2. Consume the store actions and state
  const images = useConversionStore((state) => state.images);
  const addImages = useConversionStore((state) => state.addImages);
  const updateImage = useConversionStore((state) => state.updateImage);
  const clearCompleted = useConversionStore((state) => state.clearCompleted);

  // 3. Keep transient UI state local (we don't want to persist this to IndexedDB)
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const { ffmpeg, isFfmpegLoaded } = useFFmpeg();

  const handleUpload = async (file: File) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      message.error(`File type ${file.type} is not supported.`);
      return false;
    }

    const { w, h } = await getImageDimensions(file);
    const newImage: ImageItem = {
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      originalWidth: w,
      originalHeight: h,
      targetWidth: w,
      targetHeight: h,
      targetFormat: "mp4",
      status: "Pending",
      progress: 0,
      createdAt: Date.now(),
    };

    // 4. Use the Zustand action instead of setImages
    addImages([newImage]);
    return false;
  };

  const convertImage = async (id: string) => {
    // Note: We pull fresh from the store to ensure we have the latest state
    const item = useConversionStore
      .getState()
      .images.find((img) => img.id === id);
    if (!item || item.status === "Converting") return;

    // 5. Use the Zustand update action
    updateImage(id, { status: "Converting", progress: 0 });

    try {
      const w =
        item.targetWidth % 2 === 0 ? item.targetWidth : item.targetWidth + 1;
      const h =
        item.targetHeight % 2 === 0 ? item.targetHeight : item.targetHeight + 1;

      const inputExt = item.file.name.split(".").pop();
      const inputName = `input_${id}.${inputExt}`;
      const outputName = `output_${id}.${item.targetFormat}`;

      ffmpeg.on("progress", ({ progress }) => {
        updateImage(id, {
          progress: Math.max(0, Math.min(95, Math.round(progress * 100))),
        });
      });

      await ffmpeg.writeFile(inputName, await fetchFile(item.file));

      await ffmpeg.exec([
        "-loop",
        "1",
        "-i",
        inputName,
        "-t",
        DEFAULT_VIDEO_DURATION,
        "-r",
        DEFAULT_FRAMERATE,
        "-preset",
        "ultrafast",
        "-pix_fmt",
        "yuv420p",
        "-s",
        `${w}x${h}`,
        outputName,
      ]);

      const data = await ffmpeg.readFile(outputName);

      // IMPORTANT for IndexedDB: We create the Blob and the URL.
      // The store will save the outputUrl string, but because we are using IndexedDB,
      // you might later want to save the raw Blob to the store if you want downloads to persist across refreshes!
      const outputBlob = new Blob([data as unknown as BlobPart], {
        type: `video/${item.targetFormat}`,
      });

      updateImage(id, {
        status: "Done",
        progress: 100,
        outputUrl: URL.createObjectURL(outputBlob),
        outputBlob: outputBlob,
      });

      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch (error) {
      console.error(error);
      updateImage(id, { status: "Error", progress: 0 });
      message.error(`Failed to convert image.`);
    } finally {
      ffmpeg.off("progress", () => {});
    }
  };

  const processBatch = async () => {
    setIsProcessingBatch(true);
    // Pull the latest from state inside the async function
    const pendingImages = useConversionStore
      .getState()
      .images.filter(
        (img) => img.status === "Pending" || img.status === "Error",
      );

    for (const img of pendingImages) {
      await convertImage(img.id);
    }

    setIsProcessingBatch(false);
    message.success("Batch processing complete!");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="text-center">
        <Title level={2}>Image to Video Converter</Title>
        <Text type="secondary">
          100% Client-Side. No server uploads. Converts images to 5-second
          videos.
        </Text>
      </div>

      <Uploader onUpload={handleUpload} />

      {images.length > 0 && (
        <Card
          title={`Processing Queue (${images.length})`}
          className="shadow-sm"
          extra={
            <Space>
              {/* Added a nice 'Clear Completed' button since we have the action now! */}
              {images.some((img) => img.status === "Done") && (
                <Popconfirm
                  title="Clear all completed items?"
                  onConfirm={clearCompleted}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button icon={<DeleteOutlined />} danger>
                    Clear Done
                  </Button>
                </Popconfirm>
              )}

              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={processBatch}
                disabled={
                  !isFfmpegLoaded ||
                  isProcessingBatch ||
                  images.every((img) => img.status === "Done")
                }
              >
                Convert Pending
              </Button>
            </Space>
          }
        >
          <List
            itemLayout="horizontal"
            dataSource={images}
            renderItem={(item) => (
              <QueueItem
                key={item.id}
                item={item}
                isFfmpegLoaded={isFfmpegLoaded}
                onUpdate={updateImage}
                onConvert={convertImage}
              />
            )}
          />
        </Card>
      )}
    </div>
  );
};
