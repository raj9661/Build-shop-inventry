"use client"

import { Button } from "@/components/ui/button"
import { useCompactMode } from "./compact-mode-provider"
import { Minimize2, Maximize2 } from "lucide-react"

export function CompactModeToggle() {
  const { isCompactMode, toggleCompactMode } = useCompactMode()

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleCompactMode}
      className="fixed bottom-4 right-4 z-50"
    >
      {isCompactMode ? (
        <>
          <Maximize2 className="h-4 w-4 mr-2" />
          Normal Mode
        </>
      ) : (
        <>
          <Minimize2 className="h-4 w-4 mr-2" />
          Compact Mode
        </>
      )}
    </Button>
  )
} 