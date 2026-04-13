export const submitTextareaOnEnter: (
  e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
) => void = (e) => {
  if (e.nativeEvent.isComposing) return;

  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    const form = e.currentTarget.form;
    form?.requestSubmit();
  }
};
