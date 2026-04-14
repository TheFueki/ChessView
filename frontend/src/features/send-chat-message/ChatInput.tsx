import { useState, type KeyboardEvent } from "react";
import { SendHorizonal } from "lucide-react";
import { useMessageStore } from "@/entities/message";
import { Button, Input } from "@/shared/ui";
import { useSendMessage } from "./model";

export function ChatInput() {
  const [value, setValue] = useState("");
  const chatError = useMessageStore((state) => state.error);
  const { sendMessage, isSending, maxLength } = useSendMessage();

  const submit = () => {
    const sent = sendMessage(value);
    if (sent) {
      setValue("");
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const remaining = maxLength - value.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value.slice(0, maxLength))}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          maxLength={maxLength}
          error={chatError ?? undefined}
          className="flex-1"
        />
        <Button
          type="button"
          size="md"
          onClick={submit}
          disabled={isSending || value.trim().length === 0}
          className="px-4"
        >
          <SendHorizonal className="h-4 w-4" />
          Send
        </Button>
      </div>

      <div className="text-right text-xs text-neutral-500">{remaining} characters left</div>
    </div>
  );
}
