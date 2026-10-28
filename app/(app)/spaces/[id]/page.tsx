"use client";

import { use } from "react";
import SpaceView from "@/components/SpaceView";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <SpaceView spaceId={id} />;
}
