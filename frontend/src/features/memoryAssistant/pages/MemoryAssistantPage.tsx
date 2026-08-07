import { MessageCircle } from "lucide-react";
import { useState, type FormEvent } from "react";

import { ApiError } from "../../../api/client";
import { AppShell } from "../../../app/layout/AppShell";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Heading, Text } from "../../../components/ui/Typography";
import { UserMenu } from "../../auth/components/UserMenu";
import { LinkListItem } from "../../links/components/LinkListItem";
import { useAskMemoryAssistant } from "../hooks";

/**
 * Minimal Memory Assistant: one input, one Ask button, the AI's answer,
 * and the links it cited. No conversation history, no chat bubbles, no
 * streaming — each ask is a single independent request/response.
 */
export function MemoryAssistantPage() {
  const [question, setQuestion] = useState("");
  const ask = useAskMemoryAssistant();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    ask.mutate(question.trim());
  }

  return (
    <AppShell activeNav="assistant" navActions={<UserMenu />}>
      <Heading level="h1" className="mb-4">
        Memory Assistant
      </Heading>
      <form onSubmit={handleSubmit} className="mb-8 flex flex-col gap-4">
        <Input
          label="Ask about your saved links"
          placeholder="What did I save about pricing strategy?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <Button type="submit" isLoading={ask.isPending} className="self-start">
          Ask
        </Button>
      </form>

      {!ask.data && !ask.isPending && !ask.isError && (
        <EmptyState
          icon={MessageCircle}
          title="Ask about your saved links"
          description='Try a natural-language question, like "what did I save about pricing?"'
        />
      )}

      {ask.isError && (
        <ErrorState
          title="Memory Assistant is temporarily unavailable"
          description={ask.error instanceof ApiError ? ask.error.detail : "Please try again."}
        />
      )}

      {ask.data && (
        <div className="flex flex-col gap-6">
          <Text variant="body-lg" tone="primary">
            {ask.data.answer}
          </Text>
          {ask.data.cited_links.length > 0 && (
            <div className="flex flex-col gap-4">
              {ask.data.cited_links.map((link) => (
                <LinkListItem key={link.id} link={link} />
              ))}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
