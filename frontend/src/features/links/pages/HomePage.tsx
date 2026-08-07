import { Inbox } from "lucide-react";

import { AppShell } from "../../../app/layout/AppShell";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { CardSkeleton } from "../../../components/feedback/Skeleton";
import { Heading } from "../../../components/ui/Typography";
import { useToast } from "../../../components/ui/Toast";
import { UserMenu } from "../../auth/components/UserMenu";
import { LinkListItem } from "../components/LinkListItem";
import { SaveLinkForm } from "../components/SaveLinkForm";
import { useDeleteLink, useLinks } from "../hooks";

export function HomePage() {
  const { data, isLoading, isError, refetch } = useLinks();
  const deleteLink = useDeleteLink();
  const { showToast } = useToast();

  function handleDelete(id: string) {
    deleteLink.mutate(id, {
      onError: () => showToast({ title: "Couldn't delete that link", tone: "danger" }),
    });
  }

  return (
    <AppShell activeNav="dashboard" navActions={<UserMenu />}>
      <section className="mb-8">
        <Heading level="h1" className="mb-4">
          Save a link
        </Heading>
        <SaveLinkForm />
      </section>

      <section>
        <Heading level="h2" className="mb-4">
          Recent links
        </Heading>

        {isLoading && (
          <div className="flex flex-col gap-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {isError && (
          <ErrorState
            title="Couldn't load your links"
            description="Check your connection and try again."
            action={
              <Button size="sm" variant="secondary" onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        )}

        {!isLoading && !isError && data?.items.length === 0 && (
          <EmptyState
            icon={Inbox}
            title="Nothing saved yet"
            description="Paste a link above to get started."
          />
        )}

        {!isLoading && !isError && data && data.items.length > 0 && (
          <div className="flex flex-col gap-4">
            {data.items.map((link) => (
              <LinkListItem
                key={link.id}
                link={link}
                onDelete={handleDelete}
                isDeleting={deleteLink.isPending && deleteLink.variables === link.id}
              />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
