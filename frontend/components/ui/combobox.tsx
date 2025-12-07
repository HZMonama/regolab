"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PoliciesContext } from "@/components/files-list"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"


export function Combobox() {
  const [open, setOpen] = React.useState(false)
  const context = React.useContext(PoliciesContext)
  const policies = context?.policies ?? []
  const selected = context?.selected ?? null
  const setSelected = context?.setSelected ?? (() => {})

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[400px] justify-between"
        >
          <span className="font-display">{selected ?? "Select Policy"}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput placeholder="Search policies..." className="h-9" />
          <CommandList>
            <CommandEmpty>No policies found.</CommandEmpty>
            <CommandGroup>
              {policies.map((id) => (
                <CommandItem
                  key={id}
                  value={id}
                  onSelect={(currentValue) => {
                    setSelected(currentValue === selected ? null : currentValue)
                    setOpen(false)
                  }}
                >
                  <span className="font-sans font-light">{id}</span>
                  <Check
                    className={cn(
                      "ml-auto",
                      selected === id ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
