import React, { useEffect, useState } from "react";
import { Paper, Typography } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import DescriptionIcon from "@mui/icons-material/Description";
import clsx from "clsx";

import { type ServerRenderedMessage } from "@/components/Chat/Message";
import { HorizontalStack, Section } from "@/components/Layout/Containers";
import { CloseModalButton } from "@/components/Overlays/BaseModal";
import IconButton from "@/components/Button/IconButton";
import Tooltip from "@/components/Tooltip/Tooltip";
import Popconfirm from "@/components/Popover/Popconfirm";
import ButtonBase from "@/components/Button/ButtonBase";
import { isImageExtension } from "@/utils/validators/sharedValues/messages";
import { formatBytes } from "@/utils/storageUnits";
import { env } from "@/utils/env";
import { useUser } from "@/trpc/hooks/useUser";

type Props = {
  message: ServerRenderedMessage;
  initialAttachmentIndex: number;
  onClose: () => void;
};

type AttachmentPreviewItemProps = {
  attachment: ServerRenderedMessage["attachments"][number];
  isActive: boolean;
  onClick: () => void;
};

const sliderButtonClassName =
  "transition p-3 md:p-8 bg-[rgb(var(--mui-palette-background-paperChannel)/0.5)] hover:bg-[rgb(var(--mui-palette-background-paperChannel)/0.9)] hover:cursor-pointer flex justify-center items-center";

const AttachmentPreviewItem = ({
  attachment,
  isActive,
  onClick,
}: AttachmentPreviewItemProps) => {
  const isImage = isImageExtension(attachment.extension);
  const fileName = `${attachment.original_name}.${attachment.extension}`;

  return (
    <ButtonBase
      className={clsx(
        "transition bg-mui-action-hover hover:opacity-80 hover:cursor-pointer size-6 max-w-6 max-h-6 md:size-10 md:max-w-10 md:max-h-10",
        !isActive && "opacity-50"
      )}
      onClick={onClick}
    >
      {isImage ? (
        // eslint-disable-next-line
        <img
          alt={fileName}
          src={`${env.NEXT_PUBLIC_CDN_URL}/${attachment.object_key}`}
          className={clsx("w-full h-full object-cover")}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <Paper
          className={clsx(
            "flex justify-center items-center border border-mui-divider shadow-none w-full h-full"
          )}
          elevation={2}
        >
          <Typography color="textSecondary" className="leading-0">
            <DescriptionIcon fontSize="inherit" />
          </Typography>
        </Paper>
      )}
    </ButtonBase>
  );
};

const AttachmentModal = ({
  message,
  onClose,
  initialAttachmentIndex,
}: Props) => {
  const [currentAttachmentIndex, setCurrentAttachmentIndex] = useState(
    initialAttachmentIndex
  );
  const user = useUser();
  const attachment =
    message.attachments[currentAttachmentIndex] || message.attachments[0];

  const isImage = isImageExtension(attachment.extension);
  const fileName = `${attachment.original_name}.${attachment.extension}`;
  const fileUrl = `${env.NEXT_PUBLIC_CDN_URL}/${attachment.object_key}`;

  const isOwnMessage = message.user_id === user.data?.user?.id;
  const itemCount = message.attachments.length;
  const hasMultipleItems = itemCount > 1;

  const closeOnSelfClick = (event: React.MouseEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;

    onClose();
  };

  useEffect(() => {
    if (currentAttachmentIndex > itemCount - 1) {
      setCurrentAttachmentIndex(Math.max(0, itemCount - 1));
    }
  }, [itemCount, currentAttachmentIndex]);

  return (
    <div className="flex flex-col h-full">
      <Paper elevation={8} className="rounded-none">
        <Section>
          <div className="flex justify-between items-center gap-1 max-md:flex-wrap">
            <Typography>
              {fileName} ({formatBytes(attachment.size_bytes || 0)})
            </Typography>
            <HorizontalStack wrap={false} addClassName="ml-auto">
              {isOwnMessage && (
                <Popconfirm
                  title="Are you sure you want to delete this file?"
                  onConfirm={() => {
                    console.log("deleted");
                  }}
                >
                  <Tooltip title="Delete file">
                    <IconButton
                      size="large"
                      color="error"
                      aria-label="delete file"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </Popconfirm>
              )}
              <Tooltip title="Download file">
                <a
                  href={fileUrl}
                  download
                  target="_blank"
                  className="text-inherit"
                >
                  <IconButton
                    size="large"
                    color="inherit"
                    aria-label="download file"
                  >
                    <DownloadIcon />
                  </IconButton>
                </a>
              </Tooltip>
              <CloseModalButton onClose={onClose} />
            </HorizontalStack>
          </div>
        </Section>
      </Paper>
      <div
        className="flex-1 flex gap-2 justify-between items-stretch min-h-0"
        onClick={closeOnSelfClick}
      >
        {hasMultipleItems && (
          <ButtonBase
            className={sliderButtonClassName}
            onClick={() => {
              setCurrentAttachmentIndex((prev) => {
                const newValue = prev - 1;
                return newValue < 0 ? itemCount - 1 : newValue;
              });
            }}
          >
            <ArrowForwardIosIcon
              color="inherit"
              className="rotate-180 text-mui-text-secondary min-md:text-3xl"
            />
          </ButtonBase>
        )}
        <div
          className="my-20 mx-6 md:mx-20 w-full relative flex justify-center items-center"
          onClick={closeOnSelfClick}
        >
          {isImage ? (
            // eslint-disable-next-line
            <img
              alt={fileName}
              src={fileUrl}
              className={clsx(
                "min-w-40 min-h-40 max-w-full max-h-full object-contain"
              )}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <Paper
              className={clsx(
                "flex justify-center items-center border border-mui-divider shadow-none w-full h-32 md:w-1/2 md:h-1/2"
              )}
              elevation={2}
            >
              <Typography color="textSecondary" className="leading-0">
                <DescriptionIcon fontSize="large" />
                <Typography
                  variant="subtitle2"
                  className="text-center uppercase"
                >
                  {attachment.extension}
                </Typography>
              </Typography>
            </Paper>
          )}
          {hasMultipleItems && (
            <div className="flex justify-center mt-2 gap-1 rounded-md overflow-hidden absolute -bottom-12 left-1/2 -translate-x-1/2">
              {message.attachments.map((attachment, i) => (
                <AttachmentPreviewItem
                  key={attachment.id}
                  attachment={attachment}
                  isActive={currentAttachmentIndex === i}
                  onClick={() => {
                    setCurrentAttachmentIndex(i);
                  }}
                />
              ))}
            </div>
          )}
        </div>
        {hasMultipleItems && (
          <ButtonBase
            className={sliderButtonClassName}
            onClick={() => {
              setCurrentAttachmentIndex((prev) => {
                const newValue = prev + 1;
                return newValue > itemCount - 1 ? 0 : newValue;
              });
            }}
          >
            <ArrowForwardIosIcon
              color="inherit"
              className="text-mui-text-secondary min-md:text-3xl"
            />
          </ButtonBase>
        )}
      </div>
    </div>
  );
};

export default AttachmentModal;
