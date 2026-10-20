import { useEffect, useState } from "react";
export function usePeerWarning(eventId: string) {
  const [peers, setPeers] = useState(0);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("event-seating-tool-editing"),
      instance = crypto.randomUUID(),
      known = new Set<string>();
    channel.onmessage = ({ data }: { data: unknown }) => {
      if (!data || typeof data !== "object") return;
      const msg = data as {
        eventId?: string;
        instance?: string;
        type?: string;
      };
      if (msg.eventId !== eventId || !msg.instance || msg.instance === instance)
        return;
      if (msg.type === "bye") known.delete(msg.instance);
      else {
        known.add(msg.instance);
        if (msg.type === "hello")
          channel.postMessage({ eventId, instance, type: "present" });
      }
      setPeers(known.size);
    };
    channel.postMessage({ eventId, instance, type: "hello" });
    return () => {
      channel.postMessage({ eventId, instance, type: "bye" });
      channel.close();
    };
  }, [eventId]);
  return peers > 0;
}
