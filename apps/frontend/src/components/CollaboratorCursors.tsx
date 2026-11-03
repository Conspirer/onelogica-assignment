"use client";

import { memo } from "react";
import type { CollaboratorPresence } from "@onelogica/shared-types";

interface CollaboratorCursorsProps {
  collaborators: CollaboratorPresence[];
  currentUserId?: string;
}

function CollaboratorCursorsComponent({ collaborators, currentUserId }: CollaboratorCursorsProps) {
  // Only render cursors for remote collaborators with valid cursor coordinates
  const activeCursors = collaborators.filter(
    (c) => c.userId !== currentUserId && c.cursor && typeof c.cursor.x === "number" && typeof c.cursor.y === "number",
  );

  if (activeCursors.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      {activeCursors.map((c) => {
        const x = c.cursor!.x;
        const y = c.cursor!.y;
        const color = c.color || "#3b82f6";
        const name = c.displayName || "Collaborator";

        return (
          <div
            key={c.id || c.userId}
            className="absolute transition-transform duration-75 ease-out"
            style={{
              transform: `translate3d(${x}px, ${y}px, 0)`,
            }}
          >
            {/* Custom SVG Cursor Arrow */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-md"
            >
              <path
                d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
                fill={color}
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            </svg>

            {/* Name Badge */}
            <div
              className="ml-4 -mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm whitespace-nowrap"
              style={{ backgroundColor: color }}
            >
              {name}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const CollaboratorCursors = memo(CollaboratorCursorsComponent);
