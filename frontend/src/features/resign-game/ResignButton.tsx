import { Button } from "@/shared/ui";
import { useResignGame } from "./model";

export function ResignButton() {
  const { resign, canResign } = useResignGame();

  return (
    <Button variant="danger" className="w-full" onClick={resign} disabled={!canResign}>
      Resign
    </Button>
  );
}
