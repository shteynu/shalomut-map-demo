import {
  Award,
  Building2,
  Compass,
  Handshake,
  MessageCircle,
  Scale,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  "self-expression": MessageCircle,
  "professional-competence": Award,
  "social-resource": Users,
  balance: Scale,
  "management-support": Handshake,
  certainty: Compass,
  "organizational-climate": Building2,
  meaning: Sparkles,
};

export function DimensionIcon({ dimensionId, size = 22 }: { dimensionId: string; size?: number }) {
  const Icon = icons[dimensionId] ?? Sparkles;
  return <Icon size={size} aria-hidden="true" />;
}
