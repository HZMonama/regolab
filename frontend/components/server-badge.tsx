"use client";

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ServerBadge() {
  const [available, setAvailable] = useState<boolean>(false);
  const [version, setVersion] = useState<string>("...");
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const checkStatus = useCallback(async (manual = false) => {
    if (manual) {
      setIsChecking(true);
    }
    try {
      const res = await fetch("/api/opa/status");
      const data = await res.json();
      setAvailable(data.available);
      setVersion(data.version || "unknown");
      if (manual) {
        if (data.available) {
          toast.success(`OPA CLI v${data.version} is available`);
        } else {
          toast.error("OPA CLI not found");
        }
      }
    } catch {
      setAvailable(false);
      setVersion("error");
      if (manual) {
        toast.error("Failed to connect to backend");
      }
    } finally {
      if (manual) {
        setIsChecking(false);
      }
    }
  }, []);

  useEffect(() => {
    checkStatus(false);
  }, [checkStatus]);

  const handleClick = () => {
    checkStatus(true);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            onClick={handleClick}
            disabled={isChecking}
            className="inline-flex items-center gap-2 px-2 py-1 border rounded-md bg-card text-muted-foreground text-xs font-medium hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
          >
            <div
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                available ? "bg-green-500" : "bg-red-500",
                isChecking && "animate-pulse"
              )}
            />
            OPA v{version}
          </button>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>
          <p>{available ? "Click to ping OPA CLI" : "OPA CLI not available"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
