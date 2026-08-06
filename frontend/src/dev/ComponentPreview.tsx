/**
 * INTERNAL ONLY — not a product page, not linked from any nav, not part of
 * the router (no routing exists yet). This exists solely so the reusable
 * UI component library can be visually verified (screenshotted at desktop
 * and narrow widths) during Module 8. Safe to delete once real pages are
 * built and exercise these components directly.
 */
import { Inbox, Search } from "lucide-react";
import { useState } from "react";

import { AppShell } from "../app/layout/AppShell";
import { Badge } from "../components/ui/Badge";
import { Button, IconButton } from "../components/ui/Button";
import { Card, CardBody, CardFooter, CardHeader } from "../components/ui/Card";
import { EmptyState } from "../components/feedback/EmptyState";
import { ErrorState } from "../components/feedback/ErrorState";
import { Input } from "../components/ui/Input";
import { CardSkeleton } from "../components/feedback/Skeleton";
import { Tag } from "../components/ui/Tag";
import { TextArea } from "../components/ui/TextArea";
import { Heading, Text } from "../components/ui/Typography";
import { useToast } from "../components/ui/Toast";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <Heading level="h2" className="mb-4">
        {title}
      </Heading>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

export function ComponentPreview() {
  const { showToast } = useToast();
  const [tags, setTags] = useState(["pricing", "competitor-analysis"]);

  return (
    <AppShell activeNav="dashboard" navActions={<Button variant="ghost" size="sm">Log out</Button>}>
      <Section title="Typography">
        <div className="flex flex-col gap-2">
          <Heading level="display">Display heading</Heading>
          <Heading level="h1">H1 page title</Heading>
          <Heading level="h2">H2 section header</Heading>
          <Heading level="h3">H3 card title</Heading>
          <Text variant="body-lg">Body-lg reading text for summaries and notes.</Text>
          <Text variant="body">Default body text used across the UI.</Text>
          <Text variant="label">Label text</Text>
          <Text variant="caption">Caption metadata — saved 3 days ago</Text>
          <Text variant="overline">Overline eyebrow</Text>
        </div>
      </Section>

      <Section title="Buttons">
        <Button variant="primary">Save link</Button>
        <Button variant="secondary">Cancel</Button>
        <Button variant="ghost">Ghost action</Button>
        <Button variant="destructive">Delete</Button>
        <Button isLoading>Saving</Button>
        <Button disabled>Disabled</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
        <IconButton aria-label="Search">
          <Search className="size-4" strokeWidth={1.75} />
        </IconButton>
      </Section>

      <Section title="Inputs">
        <div className="w-80">
          <Input label="URL" placeholder="https://example.com/article" />
        </div>
        <div className="w-80">
          <Input label="Email" error="Please enter a valid email" defaultValue="not-an-email" />
        </div>
        <div className="w-80">
          <TextArea label="Why are you saving this?" placeholder="Saving for the Q3 pricing deck..." />
        </div>
      </Section>

      <Section title="Card">
        <Card className="w-96" interactive role="button" tabIndex={0}>
          <CardHeader>
            <Text variant="caption">example.com</Text>
            <Badge tone="success">enriched</Badge>
          </CardHeader>
          <CardBody>
            <Heading level="h3">Competitor Pricing Breakdown 2026</Heading>
            <Text variant="body">
              A guide to benchmarking pricing across a market, covering value-based, cost-plus, and
              dynamic pricing models.
            </Text>
          </CardBody>
          <CardFooter>
            <div className="flex gap-2">
              <Tag>pricing</Tag>
              <Tag onRemove={() => {}}>research</Tag>
            </div>
            <Text variant="caption">2 days ago</Text>
          </CardFooter>
        </Card>
        <CardSkeleton />
      </Section>

      <Section title="Badges &amp; Tags">
        <Badge>research</Badge>
        <Badge tone="success">enriched</Badge>
        <Badge tone="warning">partial</Badge>
        <Badge tone="danger">failed</Badge>
        <Tag>pricing</Tag>
        <Tag
          onRemove={() => setTags((t) => t.filter((tag) => tag !== "competitor-analysis"))}
        >
          {tags.includes("competitor-analysis") ? "competitor-analysis" : "removed"}
        </Tag>
      </Section>

      <Section title="Empty &amp; Error States">
        <div className="w-96">
          <EmptyState
            icon={Inbox}
            title="Nothing saved yet"
            description="Paste a link above to get started."
            action={<Button size="sm">Save your first link</Button>}
          />
        </div>
        <div className="w-96">
          <ErrorState
            title="Couldn't load your links"
            description="Check your connection and try again."
            action={<Button size="sm" variant="secondary">Retry</Button>}
          />
        </div>
      </Section>

      <Section title="Toast">
        <Button onClick={() => showToast({ title: "Saved and summarized", tone: "success" })}>
          Show success toast
        </Button>
        <Button
          variant="destructive"
          onClick={() => showToast({ title: "Couldn't save that link", description: "Check the URL and try again.", tone: "danger" })}
        >
          Show error toast
        </Button>
      </Section>
    </AppShell>
  );
}
