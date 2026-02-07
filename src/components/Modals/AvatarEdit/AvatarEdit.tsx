import React from "react";
import { Slider, Typography } from "@mui/material";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import RotateLeftIcon from "@mui/icons-material/RotateLeft";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import { useDropzone } from "react-dropzone";
import {
  CircleStencil,
  CropperPreview,
  CropperPreviewRef,
  CropperRef,
  FixedCropper,
  FixedCropperRef,
  ImageRestriction,
} from "react-advanced-cropper";
import {
  getAbsoluteZoom,
  getZoomFactor,
} from "advanced-cropper/extensions/absolute-zoom";
import "react-advanced-cropper/dist/style.css";

import {
  HorizontalStack,
  SwitchingStack,
  VerticalStack,
} from "@/components/Layout/Containers";
import Button from "@/components/Button/Button";
import { useAppSnackbar } from "@/utils/snackbar";
import ButtonBase from "@/components/Button/ButtonBase";
import { useLocalModal } from "@/utils/hooks/useOverlay";
import Tooltip from "@/components/Tooltip/Tooltip";
import HelperText from "@/components/Fields/HelperText";
import IconButton from "@/components/Button/IconButton";
import clsx from "clsx";
import {
  AVATAR_MAX_WIDTH,
  AVATAR_MAX_HEIGHT,
  allowedAvatarExtensionsMap,
  avatarSelectSchema,
  AvatarSelectSchemaForm,
} from "@/utils/validators/shared/user";
import { createImage } from "@/pages/app/my-profile";

const normalizeZoom = (val: number) => Math.max(0, Math.min(1, val));

const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("canvas.toBlob() returned null")),
      "image/webp",
      0.9
    );
  });
};

const CustomWrapper: React.FC<{
  cropper: CropperRef;
  className?: string;
  children?: React.ReactNode;
}> = ({ cropper, children, className }) => {
  const state = cropper.getState();
  const settings = cropper.getSettings();
  const zoom = state && settings ? getAbsoluteZoom(state, settings) : 0;

  const setZoomTo = (value: number) => {
    if (!state || !settings) return;
    const nextZoom = getZoomFactor(state, settings, value);
    cropper.zoomImage(nextZoom, {
      transitions: false,
    });
  };
  const rotateBy = (deltaDegrees: number) => {
    cropper.rotateImage(deltaDegrees, { transitions: true });
  };

  return (
    <div
      className={clsx(
        "relative min-h-[200px] h-[400px] max-h-[50dvh] grow",
        className
      )}
    >
      {children}
      <SwitchingStack
        breakpoint="sm"
        addClassName="justify-between items-center dark p-1.5"
      >
        <HorizontalStack
          wrap={false}
          addClassName="items-center w-full max-w-xs"
          spacing="md"
        >
          <Tooltip title="Zoom out">
            <IconButton
              onClick={() => {
                setZoomTo(normalizeZoom(zoom - 0.1));
              }}
              disabled={zoom <= 0}
            >
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>
          <Slider
            sx={{ ":hover": { cursor: "w-resize" } }}
            value={zoom}
            min={0}
            max={1}
            step={0.01}
            onChange={(_, val) => setZoomTo(val)}
            valueLabelDisplay="auto"
            valueLabelFormat={(val) =>
              `Zoom (${Number((val * 100).toFixed(0))}%)`
            }
          />
          <Tooltip title="Zoom in">
            <IconButton
              onClick={() => {
                setZoomTo(normalizeZoom(zoom + 0.1));
              }}
              disabled={zoom >= 1}
            >
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
        </HorizontalStack>
        <div>
          <HorizontalStack addClassName="justify-center">
            <Tooltip title="Rotate left">
              <IconButton
                onClick={() => {
                  rotateBy(-90);
                }}
              >
                <RotateLeftIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Rotate right">
              <IconButton
                onClick={() => {
                  rotateBy(90);
                }}
              >
                <RotateRightIcon />
              </IconButton>
            </Tooltip>
          </HorizontalStack>
        </div>
      </SwitchingStack>
    </div>
  );
};

const AvatarChangeModal = ({
  onConfirm,
}: {
  onConfirm: (file: File) => void;
}) => {
  const cropModal = useLocalModal();
  const [rawFile, setRawFile] = React.useState<File | null>(null);
  const [rawFileDimensions, setRawFileDimensions] = React.useState<{
    width: number;
    height: number;
  } | null>(null);
  const rawFileSrc = React.useMemo(
    () => (rawFile ? URL.createObjectURL(rawFile) : ""),
    [rawFile]
  );

  const cropperRef = React.useRef<FixedCropperRef>(null);
  const cropperPreviewRef = React.useRef<CropperPreviewRef>(null);

  const { addAppSnackbar } = useAppSnackbar();

  React.useEffect(() => {
    return () => URL.revokeObjectURL(rawFileSrc);
  }, [rawFileSrc]);

  const validateAvatarFileSelect = async (file: File) => {
    const image = await createImage(file);
    const parseResult = avatarSelectSchema.safeParse({
      imageType: file.type,
    } satisfies Record<keyof AvatarSelectSchemaForm, unknown>);

    if (!parseResult.success) {
      addAppSnackbar({
        message: parseResult.error?.issues?.[0].message,
        variant: "error",
      });
      return null;
    }

    return image;
  };

  const handleFileSelect = async (file: File | undefined) => {
    if (!file) return;

    const image = await validateAvatarFileSelect(file);
    if (!image) return;
    setRawFile(file);
    setRawFileDimensions({
      width: image.naturalWidth,
      height: image.naturalHeight,
    });
    cropModal.openModal();
  };

  const onFileDrop = (files: File[]) => {
    handleFileSelect(files[0]);
  };

  const {
    getRootProps: getDropzoneRootProps,
    getInputProps: getDropzoneInputProps,
    isDragActive,
  } = useDropzone({
    onDrop: onFileDrop,
    multiple: false,
    accept: { avatar: Object.keys(allowedAvatarExtensionsMap) },
  });

  const reset = () => {
    cropperRef.current?.reset();
  };

  const exportBlob = async () => {
    if (!rawFileDimensions) return;
    const smallestAllowedDimension = Math.max(
      0,
      Math.min(
        rawFileDimensions.width,
        rawFileDimensions.height,
        AVATAR_MAX_WIDTH
      )
    );
    const canvas = cropperRef.current?.getCanvas({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
      width: smallestAllowedDimension,
      height: smallestAllowedDimension,
    });
    if (!canvas) throw new Error("Could not create result canvas");

    const blob = await canvasToBlob(canvas);

    const file = new File([blob], "cropped.webp", {
      type: "image/webp",
    });
    onConfirm(file);
  };

  const smallestImageSide = rawFileDimensions
    ? Math.min(rawFileDimensions.height, rawFileDimensions.height)
    : null;

  return (
    <VerticalStack>
      <div className="flex justify-center">
        <ButtonBase
          focusRipple
          className={clsx(
            "w-full h-64 border-2 border-dashed text-[var(--mui-palette-text-primary)] border-[var(--mui-palette-text-secondary)] transition inset-0 rounded-xl flex justify-center items-center p-2",
            isDragActive
              ? "bg-[var(--mui-palette-action-focus)]"
              : "hover:bg-[var(--mui-palette-action-focus)]"
          )}
          type="button"
          {...getDropzoneRootProps()}
        >
          <VerticalStack addClassName="items-center">
            <AddPhotoAlternateIcon fontSize="large" />
            <Typography variant="h6">
              {isDragActive
                ? "Drop the image here..."
                : "Click to select an image, or drag it here."}
            </Typography>
            <HelperText
              helperText={`Allowed formats: ${Object.values(allowedAvatarExtensionsMap).join(", ")}.`}
              helperTextAlwaysShown
            />
            <input hidden type="file" {...getDropzoneInputProps()} />
          </VerticalStack>
        </ButtonBase>
      </div>
      <cropModal.ReadyComponent
        title="Edit Image"
        onClose={() => {
          setRawFile(null);
          setRawFileDimensions(null);
          reset();
        }}
      >
        <VerticalStack addClassName="">
          <div className="">
            {smallestImageSide ? (
              <FixedCropper
                ref={cropperRef}
                src={rawFileSrc}
                stencilProps={{
                  handlers: false,
                  lines: false,
                  movable: false,
                  resizable: false,
                  aspectRatio: 1,
                }}
                wrapperComponent={CustomWrapper}
                stencilSize={{
                  width: AVATAR_MAX_WIDTH,
                  height: AVATAR_MAX_HEIGHT,
                }}
                defaultCoordinates={{
                  height: smallestImageSide,
                  width: smallestImageSide,
                }}
                imageRestriction={ImageRestriction.stencil}
                stencilComponent={CircleStencil}
                onUpdate={(cropper: CropperRef) => {
                  cropperPreviewRef.current?.update(cropper);
                }}
              />
            ) : null}
          </div>
          <div>
            <Typography>Preview:</Typography>
            <CropperPreview
              className="h-32 w-32 rounded-full"
              ref={cropperPreviewRef}
            />
          </div>
          <HorizontalStack addClassName="mt-6 justify-between">
            <HorizontalStack>
              <Button
                variant="contained"
                color="inherit"
                onClick={cropModal.closeModal}
              >
                Cancel
              </Button>
              <Button color="primary" onClick={reset}>
                Reset
              </Button>
            </HorizontalStack>
            <Button variant="contained" color="primary" onClick={exportBlob}>
              Apply
            </Button>
          </HorizontalStack>
        </VerticalStack>
      </cropModal.ReadyComponent>
    </VerticalStack>
  );
};

export default AvatarChangeModal;
