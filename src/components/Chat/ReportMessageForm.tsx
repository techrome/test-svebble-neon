import React from "react";
import z from "@/utils/zod";

import Button from "@/components/Button/Button";
import { HorizontalStack, VerticalStack } from "@/components/Layout/Containers";
import {
  CONTENT_REPORT_REASON,
  contentReportReasonOptions,
  messageReportSchema,
} from "@/utils/validators/shared/contentReport";
import { type SubmitHandler, useForm, useWatch } from "react-hook-form";
import { type RenderedMessage } from "@/components/Chat/Message";
import { zodResolver } from "@hookform/resolvers/zod";
import RadioGroup from "@/components/Fields/Radio";
import Input from "@/components/Fields/Input";
import { submitTextareaOnEnter } from "@/utils/formSubmission";

type Props = {
  message: RenderedMessage;
  onConfirm: () => void;
  onCancel: () => void;
};

type FormValues = z.infer<typeof messageReportSchema>;

const ReportMessageForm = (props: Props) => {
  const form = useForm<FormValues>({
    defaultValues: {
      messageId: props.message.id,
      additionalInfo: "",
      reason: undefined,
    },
    resolver: zodResolver(messageReportSchema),
  });

  const [reason] = useWatch({
    control: form.control,
    name: ["reason"],
  });

  const onSubmit: SubmitHandler<FormValues> = (values) => {
    console.log({ values });
    props.onConfirm();
  };

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <VerticalStack>
        <RadioGroup
          control={form.control}
          name="reason"
          label="Choose a report reason"
          options={contentReportReasonOptions}
        />
        <Input
          control={form.control}
          name="additionalInfo"
          label={`Additional information${reason === CONTENT_REPORT_REASON.other ? "" : " (optional)"}`}
          type="text"
          autoComplete="additionalInfo"
          fullWidth
          multiline
          maxRows={5}
          slotProps={{
            input: {
              onKeyDown: submitTextareaOnEnter,
            },
          }}
        />
        <HorizontalStack addClassName="justify-between items-center">
          <Button
            size="large"
            type="button"
            variant="contained"
            color="inherit"
            onClick={props.onCancel}
          >
            Cancel
          </Button>
          <Button
            size="large"
            type="submit"
            variant="contained"
            color="primary"
          >
            Report Message
          </Button>
        </HorizontalStack>
      </VerticalStack>
    </form>
  );
};

export default ReportMessageForm;
