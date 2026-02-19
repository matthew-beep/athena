import { Badge } from "../ui/Badge";

interface TierBadgeProps {
  tier: number;
  model?: string;
  latencyMs?: number;
}

export function TierBadge({ tier, model, latencyMs }: TierBadgeProps) {
  const label = model
    ? `Tier ${tier} · ${model}${latencyMs ? ` · ${(latencyMs / 1000).toFixed(1)}s` : ""}`
    : `Tier ${tier}`;
  return <Badge variant="muted">{label}</Badge>;
}
