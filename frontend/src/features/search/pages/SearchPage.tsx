import { Search as SearchIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

import { ApiError } from "../../../api/client";
import { AppShell } from "../../../app/layout/AppShell";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { CardSkeleton } from "../../../components/feedback/Skeleton";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Heading } from "../../../components/ui/Typography";
import { UserMenu } from "../../auth/components/UserMenu";
import { LinkListItem } from "../../links/components/LinkListItem";
import { useSearch } from "../hooks";

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");

  const { data, isLoading, isError, error } = useSearch(submittedQuery);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmittedQuery(query.trim());
  }

  return (
    <AppShell activeNav="search" navActions={<UserMenu />}>
      <Heading level="h1" className="mb-4">
        Search
      </Heading>
      <form onSubmit={handleSubmit} className="mb-8 flex flex-col gap-4">
        <Input
          label="Search your saved links"
          placeholder="What did I save about pricing strategy?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button type="submit" className="self-start">
          Search links
        </Button>
      </form>

      {!submittedQuery && (
        <EmptyState
          icon={SearchIcon}
          title="Find what you saved"
          description="Describe what you're looking for in your own words — no need for exact keywords."
        />
      )}

      {submittedQuery && isLoading && (
        <div className="flex flex-col gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {submittedQuery && isError && (
        <ErrorState
          title="Search is temporarily unavailable"
          description={error instanceof ApiError ? error.detail : "Please try again."}
        />
      )}

      {submittedQuery && !isLoading && !isError && data?.items.length === 0 && (
        <EmptyState
          icon={SearchIcon}
          title="No links match that search yet"
          description="Try different wording."
        />
      )}

      {submittedQuery && !isLoading && !isError && data && data.items.length > 0 && (
        <div className="flex flex-col gap-4">
          {data.items.map((item) => (
            <LinkListItem key={item.id} link={item} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
