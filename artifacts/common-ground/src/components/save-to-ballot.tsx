import { useMemo } from "react";
import {
  useListMyBallotPicks,
  useAddMyBallotPick,
  useRemoveMyBallotPick,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useInvalidateVoterData } from "@/lib/invalidate";
import { cn } from "@/lib/utils";
import { BookmarkPlus, BookmarkCheck } from "lucide-react";

/**
 * Toggles whether a candidate is saved to the signed-in voter's personal ballot.
 * Reads the picks list to reflect saved state and optimistically refetches via
 * the shared voter-data invalidator after add/remove.
 */
export function SaveToBallotButton({
  candidateId,
  variant = "outline",
  size = "sm",
  className,
  onClickCapture,
}: {
  candidateId: string;
  variant?: "outline" | "default" | "ghost" | "secondary";
  size?: "sm" | "default" | "lg";
  className?: string;
  onClickCapture?: (e: React.MouseEvent) => void;
}) {
  const { data: picks } = useListMyBallotPicks();
  const invalidate = useInvalidateVoterData();
  const add = useAddMyBallotPick();
  const remove = useRemoveMyBallotPick();

  const saved = useMemo(
    () => (picks ?? []).some((p) => p.candidate.id === candidateId),
    [picks, candidateId],
  );
  const pending = add.isPending || remove.isPending;

  const toggle = (e: React.MouseEvent) => {
    onClickCapture?.(e);
    if (pending) return;
    if (saved) {
      remove.mutate({ candidateId }, { onSuccess: () => void invalidate() });
    } else {
      add.mutate(
        { data: { candidateId } },
        { onSuccess: () => void invalidate() },
      );
    }
  };

  return (
    <Button
      variant={saved ? "secondary" : variant}
      size={size}
      className={cn("gap-1.5", className)}
      disabled={pending}
      onClick={toggle}
      aria-pressed={saved}
    >
      {saved ? (
        <BookmarkCheck className="h-4 w-4 text-primary" />
      ) : (
        <BookmarkPlus className="h-4 w-4" />
      )}
      {saved ? "Saved to ballot" : "Save to ballot"}
    </Button>
  );
}
