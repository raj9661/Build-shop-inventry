"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import { enUS } from "date-fns/locale"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import "react-day-picker/dist/style.css"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

// A clean, aligned calendar wrapper. We let DayPicker handle the table layout
// and only style the day buttons so headers and dates always line up.
function Calendar({
  className,
  showOutsideDays = true,
  locale = enUS,
  ...props
}: CalendarProps) {
  return (
    <div className="rdp-wrapper-sunday">
      <style>{`
        /* Force DayPicker to use a strict 7-column table layout */
        .rdp-wrapper-sunday .rdp-table{table-layout:fixed;width:100%}
        .rdp-wrapper-sunday .rdp-row{display:table-row}
        .rdp-wrapper-sunday .rdp-head_cell{display:table-cell;width:14.2857%;text-align:center}
        .rdp-wrapper-sunday .rdp-cell{display:table-cell;width:14.2857%;text-align:center;padding:0}
        /* Sundays red in header (increase specificity) */
        /* Try multiple selectors to match DayPicker header cell */
        .rdp-wrapper-sunday .rdp-head_cell:first-child,
        .rdp-wrapper-sunday .rdp-head_cell:first-child > *,
        .rdp-wrapper-sunday thead tr th:first-child,
        .rdp-wrapper-sunday .rdp-weekday:nth-child(1) { color:#dc2626 !important }
      `}</style>
      <DayPicker
      showOutsideDays={showOutsideDays}
      // Force Sunday as the first day while keeping the provided locale intact
      locale={locale}
      weekStartsOn={0}
        className={cn("p-3", className)}
      modifiers={{ sunday: { dayOfWeek: 0 } }}
      modifiersClassNames={{ sunday: "text-red-600" }}
      // Render single-letter weekday (S M T W T F S) for perfect fit
      formatters={{
        formatWeekdayName: (date, options) => format(date, "EEEEE", options),
      }}
      {...props}
    />
    </div>
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
