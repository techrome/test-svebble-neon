import React, { useEffect, useMemo, useRef, useState } from "react";
import { Paper, Typography, Backdrop, CircularProgress } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import NextImage from "next/image";
import DescriptionIcon from "@mui/icons-material/Description";
import ErrorIcon from "@mui/icons-material/Error";
import ReplayIcon from "@mui/icons-material/Replay";
import CloseIcon from "@mui/icons-material/Close";
import WarningIcon from "@mui/icons-material/Warning";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

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
import { RenderedMessage } from "@/components/Chat/Message";
import Skeleton from "@/components/Skeleton/Skeleton";
import { env } from "@/utils/env";
import clsx from "clsx";
import useIsDesktop from "@/utils/hooks/useIsDesktop";
import { UseFormReturn } from "react-hook-form";
import { type MessageCreateFormValues } from "@/utils/validators/client/messages";
import HelperText from "@/components/Fields/HelperText";
import ButtonBase from "@/components/Button/ButtonBase";
import { useGlobalBaseModal } from "@/utils/hooks/useOverlay";
import AttachmentModal from "@/components/Chat/AttachmentModal";

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
              <ReplayIcon fontSize="small" />
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

const getHorizontalScrollState = (el: HTMLElement) => {
  const threshold = 1;

  return {
    atStart: el.scrollLeft <= threshold,
    atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - threshold,
  };
};

type MessageAttachmentDisplayListProps = {
  message: RenderedMessage;
};

const attachmentClassName =
  "rounded shrink-0 h-[75px] min-w-[75px] max-w-[150px] md:h-[150px] md:min-w-[150px] md:max-w-[300px]";

const mobileButtonArrowClassName = `w-5 border-0 absolute inset-y-0 bg-[rgb(var(--mui-palette-text-primaryChannel)/0.5)] md:hidden flex justify-center items-center transition disabled:opacity-0 disabled:pointer-events-none`;

export const MessageAttachmentDisplayList = ({
  message,
}: MessageAttachmentDisplayListProps) => {
  const isDesktop = useIsDesktop();
  const [scrollState, setScrollState] = useState({
    atStart: true,
    atEnd: false,
  });
  const ref = useRef<HTMLDivElement>(null);
  const globalBaseModal = useGlobalBaseModal();

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    setScrollState(getHorizontalScrollState(event.currentTarget));
  };

  const scrollAttachments = (direction: "left" | "right") => {
    const el = ref.current;
    if (!el) return;

    el.scrollBy({
      left: direction === "left" ? -el.clientWidth * 0.7 : el.clientWidth * 0.7,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    if (ref.current) {
      setScrollState(getHorizontalScrollState(ref.current));
    }
  }, [message.attachments]);

  if (!message.attachments.length) return null;

  return (
    <div className="relative ">
      <HorizontalStack
        addClassName="overflow-x-auto rounded"
        wrap={false}
        onScroll={handleScroll}
        ref={ref}
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
              const isImage = isImageExtension(x.extension);
              const fileName = `${x.original_name}.${x.extension}`;
              return (
                <Tooltip
                  title={
                    <div>
                      <strong>Name:</strong> {fileName} <br />
                      <strong>Size:</strong> {formatBytes(x.size_bytes || 0)}
                    </div>
                  }
                  key={x.id}
                >
                  <ButtonBase
                    focusRipple
                    className={clsx(
                      attachmentClassName,
                      "hover:cursor-pointer group/attachment relative overflow-hidden"
                    )}
                    onClick={() => {
                      globalBaseModal.openModal({
                        content: (
                          <AttachmentModal
                            message={message}
                            onClose={globalBaseModal.closeModal}
                            initialAttachmentIndex={index}
                          />
                        ),
                        props: { showCloseButton: false },
                      });
                    }}
                  >
                    <span className="pointer-events-none absolute inset-0 z-10 transition group-hover/attachment:bg-mui-action-focus" />

                    {isImage ? (
                      // eslint-disable-next-line
                      <img
                        alt={fileName}
                        src={`${env.NEXT_PUBLIC_CDN_URL}/${x.object_key}`}
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
                            {x.extension}
                          </Typography>
                        </Typography>
                      </Paper>
                    )}
                  </ButtonBase>
                </Tooltip>
              );
            })}
      </HorizontalStack>
      <button
        type="button"
        aria-label="Scroll attachments left"
        onClick={() => scrollAttachments("left")}
        className={clsx("left-0 rounded-l", mobileButtonArrowClassName)}
        disabled={scrollState.atStart || isDesktop}
      >
        <ArrowForwardIosIcon
          fontSize="inherit"
          className="rotate-180 text-mui-background-default text-xs"
        />
      </button>

      <button
        type="button"
        aria-label="Scroll attachments right"
        onClick={() => scrollAttachments("right")}
        className={clsx("right-0 rounded-r", mobileButtonArrowClassName)}
        disabled={scrollState.atEnd || isDesktop}
      >
        <ArrowForwardIosIcon
          fontSize="inherit"
          className="text-mui-background-default text-xs"
        />
      </button>
    </div>
  );
};
