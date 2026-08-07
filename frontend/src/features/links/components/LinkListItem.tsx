import { Trash2 } from "lucide-react";

import type { Link } from "../../../api/types";
import { Badge } from "../../../components/ui/Badge";
import { IconButton } from "../../../components/ui/Button";
import { Card, CardBody, CardFooter, CardHeader } from "../../../components/ui/Card";
import { Tag } from "../../../components/ui/Tag";
import { Heading, Text } from "../../../components/ui/Typography";

const STATUS_TONE: Record<string, "success" | "danger" | undefined> = {
  enriched: "success",
  failed: "danger",
};

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export interface LinkListItemProps {
  link: Link;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
}

/** Shared card used by both the Home page's recent-links feed and Search
 * results — one saved link, rendered as a small document, not a table row. */
export function LinkListItem({ link, onDelete, isDeleting }: LinkListItemProps) {
  const reason = link.user_note ?? link.ai_reason;
  const hasFooterContent = link.tags.length > 0 || Boolean(link.intent_category);

  return (
    <Card>
      <CardHeader>
        <Text variant="caption">{hostname(link.url)}</Text>
        <div className="flex items-center gap-2">
          {link.status !== "ready" && <Badge tone={STATUS_TONE[link.status]}>{link.status}</Badge>}
          {onDelete && (
            <IconButton
              aria-label={`Delete ${link.title ?? link.url}`}
              size="sm"
              onClick={() => onDelete(link.id)}
              disabled={isDeleting}
            >
              <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </IconButton>
          )}
        </div>
      </CardHeader>
      <CardBody>
        <a href={link.url} target="_blank" rel="noreferrer">
          <Heading level="h3" className="hover:text-accent">
            {link.title ?? link.url}
          </Heading>
        </a>
        {reason && (
          <Text variant="body" tone="primary" className="italic">
            &ldquo;{reason}&rdquo;
          </Text>
        )}
        {link.ai_summary && <Text variant="body">{link.ai_summary}</Text>}
      </CardBody>
      {hasFooterContent && (
        <CardFooter>
          <div className="flex flex-wrap gap-2">
            {link.intent_category && <Badge>{link.intent_category}</Badge>}
            {link.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
          <Text variant="caption">{new Date(link.created_at).toLocaleDateString()}</Text>
        </CardFooter>
      )}
    </Card>
  );
}
