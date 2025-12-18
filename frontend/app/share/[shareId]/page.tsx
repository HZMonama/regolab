'use client';

import * as React from "react";
import { toast } from "sonner";

import Home from "@/app/page";
import { useAuth } from "@/lib/auth-context";
import { getShare } from "@/lib/share-service";
import { usePolicies } from "@/components/files-list";

export default function SharePage({ params }: { params: { shareId: string } }) {
  const { shareId } = React.use(params as unknown as Promise<{ shareId: string }>);
  const { user, loading: authLoading } = useAuth();
  const policies = usePolicies();
  const [share, setShare] = React.useState<null | {
    id: string;
    name: string;
    files: { policy: string; input: string; data: string; test: string };
  }>(null);

  const importStartedRef = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const s = await getShare(shareId);
        if (cancelled) return;

        setShare({ id: s.id, name: s.name, files: s.files });

        // Load into scratchpad-style editor (no selection => Save disabled).
        policies.setSelected(null);
        policies.setActivePolicyContent({
          policy: s.files.policy,
          input: s.files.input,
          data: s.files.data,
          test: s.files.test,
        });
      } catch (e) {
        console.error("Failed to load share", e);
        toast.error("This share link is invalid or expired");
      }
    }

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId]);

  React.useEffect(() => {
    if (!share) return;
    if (authLoading) return;
    if (!user) return;
    if (importStartedRef.current) return;

    importStartedRef.current = true;

    (async () => {
      try {
        const preferredId = !policies.policies.includes(share.name) ? share.name : undefined;
        const newId = await policies.createPolicy(preferredId, share.files);
        if (newId) {
          toast.success("Imported shared policy to your account");
        }
      } catch (e) {
        console.error("Auto-import failed", e);
        toast.error("Failed to import shared policy");
      }
    })();
  }, [share, user, authLoading, policies]);

  // Keep the same UI as the normal editor view.
  return <Home />;
}
