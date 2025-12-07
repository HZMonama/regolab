"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import Link from "next/link"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogClose,
} from "@/components/ui/dialog"

export function NavUser({
  user,
  onSignIn,
  onSignOut,
  onDelete,
}: {
  user?: {
    name?: string
    avatar?: string
    email?: string
  }
  onSignIn?: () => void
  onSignOut?: () => void
  onDelete?: () => void
}) {
  const isLoggedIn = Boolean(user && (user.name || user.email))

  const displayName = isLoggedIn ? user!.name ?? "" : "No Account"
  const displaySub = isLoggedIn ?  user!.email ?? "" : "Sign In"

  const [confirmOpen, setConfirmOpen] = React.useState(false)

  return (
    <>
      <Popover>
      <PopoverTrigger asChild>
        <SidebarMenuButton
          asChild
          size="lg"
          className="w-full bg-sidebar-accent hover:bg-muted/50 text-muted-foreground text-left"
          tooltip={displayName}
        >
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <Avatar className="h-8 w-8 rounded-lg">
                {user?.avatar ? (
                  <AvatarImage src={user!.avatar} alt={displayName} />
                ) : (
                  <AvatarFallback className="rounded-lg">
                    {displayName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
            ) : null}

            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{displayName}</span>
              <span className="truncate text-xs text-muted-foreground">{displaySub}</span>
            </div>
          </div>
        </SidebarMenuButton>
      </PopoverTrigger>

      <PopoverContent side="right">
        <div className="flex flex-col gap-2">
          {isLoggedIn ? (
            <>
              <div className="text-sm">Account options</div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmOpen(true)}
                >
                  Delete Account
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (onSignOut) return onSignOut()
                    void fetch("/api/auth/signout", { method: "POST" }).then(() => {
                      location.reload()
                    })
                  }}
                >
                  Log out
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm">You are not signed in.</div>
              <div className="flex gap-2">
                <Link href="/signin" className="flex-1">
                  <Button variant="default" size="sm" onClick={onSignIn}>
                    Sign in
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>

      {/* Delete confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              Deleting your account is permanent and will remove all data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false)
                if (onDelete) return onDelete()
                void fetch("/api/account/delete", { method: "POST" }).then(() => {
                  location.reload()
                })
              }}
            >
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
