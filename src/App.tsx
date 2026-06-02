import { useState, useEffect, useRef } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import {
  Upload,
  Button,
  Select,
  InputNumber,
  Progress,
  Card,
  List,
  Tag,
  message,
  Space,
  Typography,
} from "antd";
import {
  InboxOutlined,
  PlayCircleOutlined,
  DownloadOutlined,
} from "@ant-design/icons";

const { Dragger } = Upload;
const { Title, Text } = Typography;

type ConversionStatus = "Pending" | "Converting" | "Done" | "Error";

interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  originalWidth: number;
  originalHeight: number;
  targetFormat: string;
  targetWidth: number;
  targetHeight: number;
  status: ConversionStatus;
  progress: number;
  outputUrl?: string;
}

function App() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isFfmpegLoaded, setIsFfmpegLoaded] = useState(false);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const ffmpegRef = useRef(new FFmpeg());
  const isLoadingRef = useRef(false);

  // Initialize FFmpeg on mount
  useEffect(() => {
    if (isLoadingRef.current || isFfmpegLoaded) return;

    const loadFFmpeg = async () => {
      isLoadingRef.current = true;

      try {
        const ffmpeg = ffmpegRef.current;

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
          "Failed to load FFmpeg. Please check your network and Cross-Origin headers.",
        );
        isLoadingRef.current = false;
      }
    };

    loadFFmpeg();
  }, [isFfmpegLoaded]);

  // Helper to extract image dimensions
  const getImageDimensions = (
    file: File,
  ): Promise<{ w: number; h: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.src = URL.createObjectURL(file);
    });
  };

  const handleUpload = async (file: File) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      message.error(`File type ${file.type} is not supported.`);
      return Upload.LIST_IGNORE;
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
    };

    setImages((prev) => [...prev, newImage]);
    return false; // Prevent default POST request
  };

  const updateImage = (id: string, updates: Partial<ImageItem>) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, ...updates } : img)),
    );
  };

  const convertImage = async (id: string) => {
    const item = images.find((img) => img.id === id);
    if (!item || item.status === "Converting") return;

    const ffmpeg = ffmpegRef.current;
    updateImage(id, { status: "Converting", progress: 0 });

    try {
      // FFmpeg requires even dimensions for yuv420p
      const w =
        item.targetWidth % 2 === 0 ? item.targetWidth : item.targetWidth + 1;
      const h =
        item.targetHeight % 2 === 0 ? item.targetHeight : item.targetHeight + 1;

      const inputExt = item.file.name.split(".").pop();
      const inputName = `input_${id}.${inputExt}`;
      const outputName = `output_${id}.${item.targetFormat}`;

      // Listen to progress for this specific conversion
      ffmpeg.on("progress", ({ progress }) => {
        // Progress goes from 0 to 1
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
        "5", // 5 seconds duration
        "-r",
        "25",
        "-preset",
        "ultrafast",
        "-pix_fmt",
        "yuv420p",
        "-s",
        `${w}x${h}`,
        outputName,
      ]);

      const data = await ffmpeg.readFile(outputName);
      const outputBlob = new Blob([data as Uint8Array], {
        type: `video/${item.targetFormat}`,
      });
      const outputUrl = URL.createObjectURL(outputBlob);

      updateImage(id, { status: "Done", progress: 100, outputUrl });

      // Cleanup FS
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch (error) {
      console.error(error);
      updateImage(id, { status: "Error", progress: 0 });
      message.error(`Failed to convert image.`);
    } finally {
      // Remove listener to prevent memory leaks or crossover progress updates
      ffmpeg.off("progress", () => {});
    }
  };

  // Process queue sequentially to prevent browser/CPU locking
  const processBatch = async () => {
    setIsProcessingBatch(true);
    const pendingImages = images.filter(
      (img) => img.status === "Pending" || img.status === "Error",
    );

    for (const img of pendingImages) {
      await convertImage(img.id);
    }

    setIsProcessingBatch(false);
    message.success("Batch processing complete!");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-gray-800">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center">
          <Title level={2}>Image to Video Converter</Title>
          <Text type="secondary">
            100% Client-Side. No server uploads. Converts images to 5-second
            videos.
          </Text>
        </div>

        <Card className="shadow-sm">
          <Dragger
            multiple
            accept=".jpg,.jpeg,.png,.webp"
            beforeUpload={handleUpload}
            showUploadList={false}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              Click or drag images to this area to upload
            </p>
            <p className="ant-upload-hint">
              Support for a single or bulk upload. Images remain in your browser
              memory.
            </p>
          </Dragger>
        </Card>

        {images.length > 0 && (
          <Card
            title={`Processing Queue (${images.length})`}
            className="shadow-sm"
            extra={
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
            }
          >
            <List
              itemLayout="horizontal"
              dataSource={images}
              renderItem={(item) => (
                <List.Item
                  className="w-full flex-col sm:flex-row items-start sm:items-center"
                  actions={[
                    item.status === "Done" ? (
                      <Button
                        type="link"
                        icon={<DownloadOutlined />}
                        href={item.outputUrl}
                        download={`video_${item.id}.${item.targetFormat}`}
                      >
                        Download
                      </Button>
                    ) : (
                      <Button
                        onClick={() => convertImage(item.id)}
                        disabled={
                          !isFfmpegLoaded || item.status === "Converting"
                        }
                      >
                        Convert
                      </Button>
                    ),
                  ]}
                >
                  <List.Item.Meta
                    className="w-full min-w-0" // min-w-0 is the secret ingredient for flexbox truncation
                    avatar={
                      <img
                        src={item.previewUrl}
                        alt="preview"
                        className="w-16 h-16 object-cover rounded shadow-sm shrink-0"
                      />
                    }
                    title={
                      <div className="flex flex-wrap items-center gap-2">
                        <Text
                          strong
                          // Use AntD's built-in ellipsis which automatically adds a tooltip on hover!
                          ellipsis={{ tooltip: item.file.name }}
                          // Tailwind handles the max-width dynamically based on screen size
                          className="max-w-30 sm:max-w-50 md:max-w-75"
                        >
                          {item.file.name}
                        </Text>

                        <Space size="small">
                          {item.status === "Pending" && (
                            <Tag color="default">Pending</Tag>
                          )}
                          {item.status === "Converting" && (
                            <Tag color="processing">Converting</Tag>
                          )}
                          {item.status === "Done" && (
                            <Tag color="success">Done</Tag>
                          )}
                          {item.status === "Error" && (
                            <Tag color="error">Error</Tag>
                          )}
                        </Space>
                      </div>
                    }
                    description={
                      <Space className="mt-2" wrap>
                        {/* Your Select and InputNumber components stay exactly the same here */}
                        <Select
                          size="small"
                          value={item.targetFormat}
                          onChange={(val) =>
                            updateImage(item.id, { targetFormat: val })
                          }
                          disabled={
                            item.status === "Converting" ||
                            item.status === "Done"
                          }
                          options={[
                            { label: "MP4", value: "mp4" },
                            { label: "AVI", value: "avi" },
                            { label: "MKV", value: "mkv" },
                          ]}
                        />
                        <InputNumber
                          size="small"
                          addonBefore="W"
                          value={item.targetWidth}
                          onChange={(val) =>
                            updateImage(item.id, {
                              targetWidth: val || item.originalWidth,
                            })
                          }
                          disabled={
                            item.status === "Converting" ||
                            item.status === "Done"
                          }
                        />
                        <InputNumber
                          size="small"
                          addonBefore="H"
                          value={item.targetHeight}
                          onChange={(val) =>
                            updateImage(item.id, {
                              targetHeight: val || item.originalHeight,
                            })
                          }
                          disabled={
                            item.status === "Converting" ||
                            item.status === "Done"
                          }
                        />
                      </Space>
                    }
                  />
                  {item.status === "Converting" && (
                    <div className="w-full sm:w-48 mt-4 sm:mt-0 sm:ml-4">
                      <Progress percent={item.progress} size="small" />
                    </div>
                  )}
                </List.Item>
              )}
            />
          </Card>
        )}
      </div>
    </div>
  );
}

export default App;
