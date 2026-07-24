"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import type { AdminUserRow } from "@/lib/style-maker/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function StyleMakerAdmin() {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState("")
  const [loginBusy, setLoginBusy] = useState(false)
  const [query, setQuery] = useState("")
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadUsers = useCallback(async (q?: string) => {
    setLoadingUsers(true)
    try {
      const params = new URLSearchParams()
      if (q?.trim()) params.set("q", q.trim())
      const response = await fetch(`/api/admin/users?${params}`)
      if (response.status === 401) {
        setAuthed(false)
        return
      }
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not load users")
      setUsers(data.users || [])
      setAuthed(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load users")
    } finally {
      setLoadingUsers(false)
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const login = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoginBusy(true)
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Login failed")
      setPassword("")
      setAuthed(true)
      await loadUsers()
      toast.success("Admin unlocked")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed")
    } finally {
      setLoginBusy(false)
    }
  }

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" })
    setAuthed(false)
    setUsers([])
  }

  const setAccess = async (userId: string, action: "grant" | "revoke") => {
    setBusyId(userId)
    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(userId)}/access`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Update failed")
      toast.success(action === "grant" ? "Free access granted" : "Access revoked")
      await loadUsers(query)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed")
    } finally {
      setBusyId(null)
    }
  }

  if (checking) {
    return (
      <div className="content-wrap page-shell py-16">
        <p className="text-slate-400">Checking admin session…</p>
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="content-wrap page-shell flex min-h-[60vh] items-center justify-center py-16">
        <form
          onSubmit={login}
          className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-black/50 p-8"
        >
          <h1 className="font-[family-name:var(--font-instrument-serif)] text-3xl text-slate-50">
            Style Maker admin
          </h1>
          <p className="text-sm text-slate-400">
            Enter the admin password to view users and grant or revoke free access.
          </p>
          <label className="block space-y-2 text-sm text-slate-300">
            Password
            <Input
              type="password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <Button type="submit" className="w-full" disabled={loginBusy || !password}>
            {loginBusy ? "Checking…" : "Unlock"}
          </Button>
        </form>
      </div>
    )
  }

  return (
    <div className="content-wrap page-shell space-y-8 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="ux-section-label">Admin</p>
          <h1 className="mt-2 font-[family-name:var(--font-instrument-serif)] text-4xl text-slate-50">
            Style Maker users
          </h1>
          <p className="mt-2 max-w-xl text-slate-400">
            See entitlement status. Refresh pulls the latest from Stripe when
            webhooks are not configured. Grant complimentary access or revoke it.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void logout()}>
          Lock
        </Button>
      </div>

      <form
        className="flex flex-wrap gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          void loadUsers(query)
        }}
      >
        <Input
          className="max-w-md"
          placeholder="Search email, name, or user id…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="submit" disabled={loadingUsers}>
          {loadingUsers ? "Loading…" : "Search"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={loadingUsers}
          onClick={() => {
            setQuery("")
            void loadUsers("")
          }}
        >
          Refresh
        </Button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-slate-500">
                  {loadingUsers ? "Loading…" : "No users found."}
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-t border-white/10">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-slate-100">
                      {user.name || "—"}
                    </div>
                    <div className="text-slate-400">{user.email || "no email"}</div>
                    {(user.phone || user.country) && (
                      <div className="mt-0.5 text-xs text-slate-500">
                        {[user.phone, user.country].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    <div className="mt-1 font-mono text-xs text-slate-500">
                      {user.id}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {user.entitled ? (
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-300">
                        {user.subscriptionStatus || "active"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-500/15 px-2.5 py-1 text-slate-400">
                        {user.subscriptionStatus || "none"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-slate-300">
                    {user.complimentary
                      ? "Complimentary"
                      : user.stripeSubscriptionId
                        ? "Stripe"
                        : user.entitled
                          ? "Entitled"
                          : "—"}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={busyId === user.id || user.entitled}
                        onClick={() => void setAccess(user.id, "grant")}
                      >
                        Offer free
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === user.id || !user.entitled}
                        onClick={() => void setAccess(user.id, "revoke")}
                      >
                        Revoke
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
