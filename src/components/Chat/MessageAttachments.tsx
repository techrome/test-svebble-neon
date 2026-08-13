import React, { useEffect, useMemo, useRef, useState } from "react";
import { Paper, Typography, Backdrop, CircularProgress } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import NextImage from "next/image";
import DescriptionIcon from "@mui/icons-material/Description";
import ErrorIcon from "@mui/icons-material/Error";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloseIcon from "@mui/icons-material/Close";
import WarningIcon from "@mui/icons-material/Warning";

import IconButton from "@/components/Button/IconButton";
import { HorizontalStack, VerticalStack } from "@/components/Layout/Containers";
import Tooltip from "@/components/Tooltip/Tooltip";
import { formatBytes } from "@/utils/storageUnits";
import {
  allowedMessageAttachmentExtensions,
  isImageExtension,
  MESSAGE_ATTACHMENT_MAX_COUNT,
} from "@/utils/validators/sharedValues/messages";
import { handleError, trpc } from "@/trpc";
import { getFileExtension } from "@/utils/validators/helpers/custom";
import { TRPCClientError } from "@trpc/client";
import { axios } from "@/trpc/axios";
import { useQueryClient } from "@tanstack/react-query";
import {
  RenderedMessage,
  type ServerRenderedMessage,
} from "@/components/Chat/Message";
import Skeleton from "@/components/Skeleton/Skeleton";
import { env } from "@/utils/env";
import clsx from "clsx";
import useIsDesktop from "@/utils/hooks/useIsDesktop";
import { UseFormReturn } from "react-hook-form";
import { type MessageCreateFormValues } from "@/utils/validators/client/messages";
import HelperText from "@/components/Fields/HelperText";
import ButtonBase from "@/components/Button/ButtonBase";
import { useLocalBaseModal } from "@/utils/hooks/useOverlay";
import AttachmentModal from "@/components/Chat/AttachmentModal";
import Popconfirm from "@/components/Popover/Popconfirm";
import { useUser } from "@/trpc/hooks/useUser";
import { htmlToText } from "@/utils/htmlToText";
import useMobileSlider from "@/utils/hooks/useMobileSlider";

const isAbortError = (error: unknown, signal?: AbortSignal) => {
  if (signal?.aborted) return true;
  const cause =
    error instanceof DOMException || error instanceof Error
      ? error
      : error instanceof TRPCClientError
        ? error.cause
        : null;

  if (cause?.name === "AbortError") return true;

  return false;
};

export type NewMessageAttachmentData = {
  id: string;
  remoteId?: string;
  objectKey?: string | null;
  file: File;
  status:
    | "Idle"
    | "Generating upload URL"
    | "Uploading"
    | "Validating"
    | "Ready to be attached"
    | "Cancelled"
    | "Error";
  statusInfo?: string;
  isImage?: boolean;
  uploadPercent?: number;
};

type MessageAttachmentsProps = {
  attachments: NewMessageAttachmentData[];
  setAttachments: React.Dispatch<
    React.SetStateAction<NewMessageAttachmentData[]>
  >;
  form: UseFormReturn<MessageCreateFormValues>;
};

type NewMessageAttachmentProps = {
  attachment: NewMessageAttachmentData;
  setAttachments: MessageAttachmentsProps["setAttachments"];
  abortControllersRef: React.RefObject<Record<string, AbortController>>;
};

const uploadingStatuses: NewMessageAttachmentData["status"][] = [
  "Generating upload URL",
  "Uploading",
  "Validating",
];

const NewMessageAttachment = ({
  attachment,
  setAttachments,
  abortControllersRef,
}: NewMessageAttachmentProps) => {
  const imageSrc = useMemo(
    () => (attachment.isImage ? URL.createObjectURL(attachment.file) : ""),
    [attachment.file, attachment.isImage]
  );
  const status = attachment.status;

  const utils = trpc.useUtils();
  const qc = useQueryClient();

  const setAttachment = (
    fields: Partial<
      Pick<
        NewMessageAttachmentData,
        "status" | "statusInfo" | "uploadPercent" | "remoteId"
      >
    >
  ) => {
    setAttachments((prev) =>
      prev.map((x) => (x.id === attachment.id ? { ...x, ...fields } : x))
    );
  };

  const startUpload = async () => {
    const abortController = new AbortController();
    const signal = abortController.signal;
    abortControllersRef.current[attachment.id] = abortController;

    try {
      setAttachment({
        status: "Generating upload URL",
        statusInfo: undefined,
        uploadPercent: undefined,
      });
      const uploadUrlData =
        await utils.client.messages.createAttachmentUploadUrl.mutate(
          {
            fileName: attachment.file.name,
            fileExtension: getFileExtension(
              attachment.file.name,
              allowedMessageAttachmentExtensions
            ),
            fileSize: attachment.file.size,
          },
          { signal }
        );
      setAttachment({ status: "Uploading" });

      await axios.put(uploadUrlData.uploadUrl, attachment.file, {
        signal,
        headers: uploadUrlData.requiredHeaders,
        onUploadProgress(progressEvent) {
          if (!progressEvent.total) return;
          const percentage = (progressEvent.loaded / progressEvent.total) * 100;
          setAttachment({ uploadPercent: percentage });
        },
      });
      setAttachment({ status: "Validating" });

      const validatedData =
        await utils.client.messages.validateMessageAttachment.mutate(
          {
            fileObjectKey: uploadUrlData.bucketKey,
          },
          { signal }
        );

      setAttachment({
        status: "Ready to be attached",
        remoteId: validatedData.id,
      });
    } catch (err) {
      if (isAbortError(err, signal)) {
        setAttachment({
          status: "Cancelled",
          statusInfo: "Upload cancelled by user",
        });
      } else if (err instanceof Error) {
        const errorInfo = handleError(qc, err);
        setAttachment({
          status: "Error",
          statusInfo: errorInfo?.message || "Something went wrong",
        });
      }
    } finally {
      delete abortControllersRef.current[attachment.id];
    }
  };

  const abortUpload = () => {
    abortControllersRef.current[attachment.id]?.abort();
  };

  useEffect(() => {
    return () => {
      abortUpload();
    };
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (status === "Idle") {
      startUpload();
    }
    // eslint-disable-next-line
  }, [status]);

  useEffect(() => {
    return () => URL.revokeObjectURL(imageSrc);
  }, [imageSrc]);

  const isUploading = uploadingStatuses.includes(status);

  return (
    <div className="relative w-20 min-w-20 h-20 lg:w-24 lg:min-w-24 lg:h-24 group">
      <Tooltip
        title={
          <div>
            <strong>Status:</strong> {status}
            {status === "Uploading" &&
            typeof attachment.uploadPercent === "number"
              ? `: ${attachment.uploadPercent?.toFixed(1)}%`
              : attachment.statusInfo
                ? `: ${attachment.statusInfo}`
                : ""}
            <br />
            <strong>Name:</strong> {attachment.file.name} <br />
            <strong>Size:</strong> {formatBytes(attachment.file.size)}
          </div>
        }
      >
        <div className="relative flex justify-center items-center w-full h-full p-1 border-mui-divider rounded-md border overflow-hidden bg-[rgb(var(--mui-palette-background-defaultChannel)/0.3)]">
          {status === "Error" ? (
            <Typography color="error">
              <ErrorIcon fontSize="large" />
            </Typography>
          ) : status === "Cancelled" ? (
            <Typography color="warning">
              <WarningIcon fontSize="large" />
            </Typography>
          ) : imageSrc ? (
            <NextImage
              alt={attachment.file.name}
              src={imageSrc}
              fill
              className="object-contain"
              unoptimized
            />
          ) : (
            <Typography color="textSecondary">
              <DescriptionIcon fontSize="large" />
            </Typography>
          )}
          {isUploading && (
            <Backdrop
              open
              className="absolute inset-0 rounded-[inherit] bg-[rgb(var(--mui-palette-background-defaultChannel)/0.6)] z-10"
            >
              <CircularProgress
                size={35}
                color="inherit"
                {...(status === "Uploading"
                  ? {
                      variant: "determinate",
                      value: attachment.uploadPercent,
                      enableTrackSlot: true,
                    }
                  : {})}
              />
              {status === "Uploading" &&
                typeof attachment.uploadPercent === "number" && (
                  <Typography
                    variant="tiny"
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  >
                    {Math.floor(attachment.uploadPercent)}%
                  </Typography>
                )}
            </Backdrop>
          )}
          <div className="pl-1 absolute bottom-0 left-0 right-0 bg-[rgb(var(--mui-palette-background-defaultChannel)/0.8)]">
            <Typography
              variant="tiny"
              {...(attachment.status === "Error"
                ? { color: "error" }
                : attachment.status === "Cancelled"
                  ? { color: "warning" }
                  : {})}
              className="text-ellipsis whitespace-nowrap overflow-hidden"
            >
              {attachment.file.name}
            </Typography>
          </div>
        </div>
      </Tooltip>
      <Paper
        elevation={4}
        className="flex gap-1 absolute top-0.5 right-0.5 rounded-full opacity-50 group-hover:opacity-100 group-focus-within:opacity-100 transition z-20"
      >
        {(attachment.status === "Cancelled" ||
          attachment.status === "Error") && (
          <Tooltip title="Retry upload">
            <IconButton
              size="small"
              onClick={() => {
                startUpload();
              }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={isUploading ? "Cancel upload" : "Remove attachment"}>
          <IconButton
            size="small"
            color="error"
            onClick={() => {
              if (isUploading) {
                abortUpload();
              } else {
                setAttachments((prev) =>
                  prev.filter((x) => x.id !== attachment.id)
                );
              }
            }}
          >
            {isUploading ? (
              <CloseIcon fontSize="small" />
            ) : (
              <DeleteIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Paper>
    </div>
  );
};

export const MessageAttachmentsUpload = ({
  attachments,
  setAttachments,
  form,
}: MessageAttachmentsProps) => {
  const abortControllersRef = useRef<Record<string, AbortController>>({});
  const errorMessage = form.formState.errors.attachmentIds?.length
    ? form.formState.errors.attachmentIds.find?.(Boolean)?.message
    : undefined;
  const hasError = !!errorMessage;

  return (
    <VerticalStack spacing="xs" addClassName="pb-2">
      <HorizontalStack
        addClassName="justify-between items-center"
        fullWidth
        wrap={false}
      >
        <HorizontalStack
          addClassName="items-center overflow-x-auto"
          spacing="xs"
          wrap={false}
        >
          {attachments.map((attachment) => (
            <NewMessageAttachment
              key={attachment.id}
              attachment={attachment}
              setAttachments={setAttachments}
              abortControllersRef={abortControllersRef}
            />
          ))}
        </HorizontalStack>
        <VerticalStack
          spacing="xs"
          fullWidth={false}
          addClassName="items-center"
        >
          <Tooltip
            title={`Selected: ${attachments.length} files. Maximum: ${MESSAGE_ATTACHMENT_MAX_COUNT}`}
          >
            <Typography variant="subtitle2" className="whitespace-nowrap">
              {attachments.length}/{MESSAGE_ATTACHMENT_MAX_COUNT}
            </Typography>
          </Tooltip>
          <Tooltip title="Remove all attachments">
            <IconButton
              color="error"
              onClick={() => {
                for (const key in abortControllersRef.current) {
                  abortControllersRef.current[key]?.abort();
                }
                setAttachments([]);
              }}
            >
              <DeleteSweepIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </VerticalStack>
      </HorizontalStack>
      {hasError && (
        <HelperText
          helperText={errorMessage}
          hasError={hasError}
          isInsideFormHelperText={false}
        />
      )}
    </VerticalStack>
  );
};

export type MessageAttachmentDeleteMutationOptions = NonNullable<
  Parameters<typeof trpc.messages.deleteAttachment.useMutation>[0]
>;

type MessageAttachmentItemProps = {
  onAttachmentClick: () => void;
  onAttachmentDeleteClick: () => void;
  message: ServerRenderedMessage;
  attachment: ServerRenderedMessage["attachments"][number];
  isOwnMessage: boolean;
  isDesktop: boolean;
  isDeleting: boolean;
  isLastAttachmentAndNoContent: boolean;
};

const MessageAttachmentItem = ({
  onAttachmentClick,
  onAttachmentDeleteClick,
  attachment,
  isOwnMessage,
  isDesktop,
  isDeleting,
  isLastAttachmentAndNoContent,
}: MessageAttachmentItemProps) => {
  const isImage = isImageExtension(attachment.extension);
  const fileName = `${attachment.original_name}.${attachment.extension}`;

  return (
    <Tooltip
      enterDelay={750}
      title={
        <div>
          <strong>Name:</strong> {fileName} <br />
          <strong>Size:</strong> {formatBytes(attachment.size_bytes || 0)}
        </div>
      }
      key={attachment.id}
    >
      <div className="relative group/attachment">
        <ButtonBase
          className={clsx(
            attachmentClassName,
            "hover:cursor-pointer relative overflow-hidden"
          )}
          onClick={onAttachmentClick}
        >
          <span className="pointer-events-none absolute inset-0 z-10 transition group-hover/attachment:bg-mui-action-focus" />

          {isImage ? (
            // eslint-disable-next-line
            <img
              alt={fileName}
              src={`${env.NEXT_PUBLIC_CDN_URL}/${attachment.object_key}?preview=1`}
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
        </ButtonBase>
        {isOwnMessage && (
          <Paper
            elevation={4}
            className={clsx(
              "flex gap-1 absolute top-0.5 right-0.5 rounded-full group-hover/attachment:opacity-100 group-focus-within/attachment:opacity-100 transition z-20",
              isDesktop && "opacity-0"
            )}
          >
            <Popconfirm
              title={`Are you sure you want to delete this file?${isLastAttachmentAndNoContent ? " This will also delete the message because it has no other content." : ""}`}
              onConfirm={onAttachmentDeleteClick}
            >
              <Tooltip title={"Delete file"}>
                <IconButton size="small" color="error" loading={isDeleting}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Popconfirm>
          </Paper>
        )}
      </div>
    </Tooltip>
  );
};

type MessageAttachmentDisplayListProps = {
  message: RenderedMessage;
  onAttachmentDeleteSuccess: MessageAttachmentDeleteMutationOptions["onSuccess"];
};

const attachmentClassName =
  "rounded shrink-0 h-[75px] min-w-[75px] max-w-[150px] md:h-[150px] md:min-w-[150px] md:max-w-[300px]";

export const MessageAttachmentDisplayList = ({
  message,
  onAttachmentDeleteSuccess,
}: MessageAttachmentDisplayListProps) => {
  const isDesktop = useIsDesktop();
  const localBaseModal = useLocalBaseModal();
  const [deletingAttachmentIds, setDeletingAttachmentIds] = useState(
    new Set<string>()
  );
  const [viewingAttachmentIndex, setViewingAttachmentIndex] =
    useState<number>(0);
  const attachmentDeleteMutation = trpc.messages.deleteAttachment.useMutation({
    onMutate(variables) {
      setDeletingAttachmentIds((prev) => {
        const next = new Set(prev);
        next.add(variables.fileId);
        return next;
      });
    },
    onSuccess: onAttachmentDeleteSuccess,
    onSettled(_data, _error, variables) {
      setDeletingAttachmentIds((prev) => {
        const next = new Set(prev);
        next.delete(variables.fileId);
        return next;
      });
    },
  });
  const user = useUser();
  const isOwnMessage = message.user_id === user.data?.user?.id;
  const attachmentCount = message.attachments.length;

  const hasContent = useMemo(
    () => Boolean(htmlToText(message.content)),
    [message.content]
  );
  const isLastAttachmentAndNoContent =
    message.attachments.length === 1 && !hasContent;

  // destructuring because of https://github.com/react/react/issues/35575
  const { parentRef: mobileSliderParentRef, ...mobileSlider } = useMobileSlider(
    { updaterDependency: message.attachments }
  );

  useEffect(() => {
    if (viewingAttachmentIndex > attachmentCount - 1) {
      setViewingAttachmentIndex(Math.max(0, attachmentCount - 1));
    }
  }, [attachmentCount, viewingAttachmentIndex]);

  if (!message.attachments.length) return null;

  return (
    <div className="relative">
      <HorizontalStack
        addClassName="overflow-x-auto rounded"
        wrap={false}
        onScroll={mobileSlider.handleScroll}
        ref={mobileSliderParentRef}
      >
        {message.isOptimistic
          ? message.attachments.map((x, i) => (
              <Skeleton
                key={i}
                variant="rounded"
                className="h-[75px] min-w-[75px] md:h-[150px] md:min-w-[150px]"
                withDefaultHeight={false}
              />
            ))
          : message.attachments.map((x, index) => {
              return (
                <MessageAttachmentItem
                  key={x.id}
                  message={message}
                  onAttachmentDeleteClick={() => {
                    attachmentDeleteMutation.mutate({
                      fileId: x.id,
                      messageId: message.id,
                    });
                  }}
                  attachment={x}
                  onAttachmentClick={() => {
                    setViewingAttachmentIndex(index);
                    localBaseModal.openModal();
                  }}
                  isOwnMessage={isOwnMessage}
                  isDesktop={isDesktop}
                  isDeleting={deletingAttachmentIds.has(x.id)}
                  isLastAttachmentAndNoContent={isLastAttachmentAndNoContent}
                />
              );
            })}
        {!message.isOptimistic && (
          <localBaseModal.ReadyComponent showCloseButton={false}>
            <AttachmentModal
              message={message}
              onClose={localBaseModal.closeModal}
              onDelete={(id) => {
                attachmentDeleteMutation.mutate({
                  fileId: id,
                  messageId: message.id,
                });
              }}
              deletingAttachmentIds={deletingAttachmentIds}
              viewingAttachmentIndex={viewingAttachmentIndex}
              setViewingAttachmentIndex={setViewingAttachmentIndex}
              isLastAttachmentAndNoContent={isLastAttachmentAndNoContent}
            />
          </localBaseModal.ReadyComponent>
        )}
      </HorizontalStack>
      {mobileSlider.buttons.left}
      {mobileSlider.buttons.right}
    </div>
  );
};
