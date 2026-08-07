import { useState, type FormEvent } from "react";

import { ApiError } from "../../../api/client";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { TextArea } from "../../../components/ui/TextArea";
import { useToast } from "../../../components/ui/Toast";
import { useCreateLink } from "../hooks";

export function SaveLinkForm() {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [urlError, setUrlError] = useState<string | undefined>();

  const createLink = useCreateLink();
  const { showToast } = useToast();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setUrlError(undefined);

    if (!url.trim()) {
      setUrlError("URL is required");
      return;
    }

    createLink.mutate(
      { url: url.trim(), note: note.trim() || undefined },
      {
        onSuccess: () => {
          setUrl("");
          setNote("");
          showToast({ title: "Saved and summarized", tone: "success" });
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 422) {
            setUrlError("Enter a valid http(s) URL");
          } else {
            showToast({ title: "Couldn't save that link", tone: "danger" });
          }
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Input
        label="URL"
        placeholder="https://example.com/article"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        error={urlError}
      />
      <TextArea
        label="Why are you saving this? (optional)"
        placeholder="Saving for the Q3 pricing deck..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button type="submit" isLoading={createLink.isPending} className="self-start">
        Save link
      </Button>
    </form>
  );
}
