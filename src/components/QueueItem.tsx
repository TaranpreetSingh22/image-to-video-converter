import {
  List,
  Button,
  Select,
  InputNumber,
  Progress,
  Tag,
  Space,
  Typography,
} from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import type { ImageItem } from "../types";
import { FORMAT_OPTIONS } from "../common/constants";

const { Text } = Typography;

interface QueueItemProps {
  item: ImageItem;
  isFfmpegLoaded: boolean;
  onUpdate: (id: string, updates: Partial<ImageItem>) => void;
  onConvert: (id: string) => void;
}

export const QueueItem = ({
  item,
  isFfmpegLoaded,
  onUpdate,
  onConvert,
}: QueueItemProps) => {
  const isConvertingOrDone =
    item.status === "Converting" || item.status === "Done";

  return (
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
            onClick={() => onConvert(item.id)}
            disabled={!isFfmpegLoaded || item.status === "Converting"}
          >
            Convert
          </Button>
        ),
      ]}
    >
      <List.Item.Meta
        className="w-full min-w-0"
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
              ellipsis={{ tooltip: item.file.name }}
              className="max-w-30 sm:max-w-50 md:max-w-75"
            >
              {item.file.name}
            </Text>
            <Space size="small">
              {item.status === "Pending" && <Tag color="default">Pending</Tag>}
              {item.status === "Converting" && (
                <Tag color="processing">Converting</Tag>
              )}
              {item.status === "Done" && <Tag color="success">Done</Tag>}
              {item.status === "Error" && <Tag color="error">Error</Tag>}
            </Space>
          </div>
        }
        description={
          <Space className="mt-2" wrap>
            <Select
              size="small"
              value={item.targetFormat}
              onChange={(val) => onUpdate(item.id, { targetFormat: val })}
              disabled={isConvertingOrDone}
              options={FORMAT_OPTIONS}
            />
            <InputNumber
              size="small"
              addonBefore="W"
              value={item.targetWidth}
              onChange={(val) =>
                onUpdate(item.id, { targetWidth: val || item.originalWidth })
              }
              disabled={isConvertingOrDone}
            />
            <InputNumber
              size="small"
              addonBefore="H"
              value={item.targetHeight}
              onChange={(val) =>
                onUpdate(item.id, { targetHeight: val || item.originalHeight })
              }
              disabled={isConvertingOrDone}
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
  );
};
