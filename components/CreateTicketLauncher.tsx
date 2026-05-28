"use client";

import { useState } from "react";
import { CreateTicketModal } from "./CreateTicketModal";
import type { BacklogProjectSetting } from "@/lib/types/settings";

interface Props {
  projects: BacklogProjectSetting[];
}

export function CreateTicketLauncher({ projects }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="primary-btn" onClick={() => setOpen(true)}>
        + チケット作成
      </button>
      <CreateTicketModal open={open} onClose={() => setOpen(false)} projects={projects} />
    </>
  );
}
