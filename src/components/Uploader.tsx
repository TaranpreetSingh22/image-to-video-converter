import { Upload, Card } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { ALLOWED_IMAGE_TYPES } from "../common/constants";

const { Dragger } = Upload;

interface UploaderProps {
  onUpload: (file: File) => Promise<boolean | string>;
}

export const Uploader = ({ onUpload }: UploaderProps) => {
  return (
    <Card className="shadow-sm">
      <Dragger
        multiple
        accept={ALLOWED_IMAGE_TYPES.map(
          (type) => `.${type.split("/")[1]}`,
        ).join(",")}
        beforeUpload={onUpload}
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
  );
};
