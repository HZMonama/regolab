"use client"

import * as React from "react"
import Image from "next/image"
import { Drawer } from "vaul"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { usePolicies } from "@/components/files-list"
import { toast } from "sonner"
import { GithubLogo, GitBranch, Upload, FolderSimple, ChatText, SignOut, ArrowsClockwise, Plus, Lock, Globe } from "phosphor-react"
import { API_BASE_URL } from "@/lib/api-config"

type Props = {
  /** controlled open state */
  open: boolean
  /** controlled open change handler */
  onOpenChange: (open: boolean) => void
}

interface Repository {
  id: number
  full_name: string
  name: string
  owner: { login: string }
  default_branch: string
  permissions?: { push: boolean }
}

interface Branch {
  name: string
}

export const ExportDrawer: React.FC<Props> = function ExportDrawer({ open, onOpenChange }) {
  const { activePolicyContent, selected } = usePolicies()
  
  // GitHub OAuth state
  const [githubToken, setGithubToken] = React.useState<string | null>(null)
  const [githubUser, setGithubUser] = React.useState<{ login: string; avatar_url: string } | null>(null)
  
  // Repository selection state
  const [repos, setRepos] = React.useState<Repository[]>([])
  const [selectedRepo, setSelectedRepo] = React.useState<string>("")
  const [branches, setBranches] = React.useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = React.useState<string>("")
  
  // Form state
  const [path, setPath] = React.useState<string>("policies/")
  const [commitMessage, setCommitMessage] = React.useState<string>("")
  
  // Loading states
  const [loadingRepos, setLoadingRepos] = React.useState(false)
  const [loadingBranches, setLoadingBranches] = React.useState(false)
  const [publishing, setPublishing] = React.useState(false)
  
  // Create repo dialog state
  const [createRepoOpen, setCreateRepoOpen] = React.useState(false)
  const [newRepoName, setNewRepoName] = React.useState("")
  const [newRepoDescription, setNewRepoDescription] = React.useState("")
  const [newRepoPrivate, setNewRepoPrivate] = React.useState(true)
  const [creatingRepo, setCreatingRepo] = React.useState(false)

  // Check for GitHub token in URL on mount (from OAuth callback)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('github_token')
    const error = params.get('github_error')
    
    if (error) {
      toast.error(`GitHub authentication failed: ${decodeURIComponent(error)}`)
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
      return
    }
    
    if (token) {
      setGithubToken(token)
      // Store in sessionStorage for persistence during session
      sessionStorage.setItem('github_token', token)
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
    } else {
      // Try to restore from sessionStorage
      const storedToken = sessionStorage.getItem('github_token')
      if (storedToken) {
        setGithubToken(storedToken)
      }
    }
  }, [])

  // Fetch GitHub user info when token is available
  React.useEffect(() => {
    if (githubToken) {
      fetch('https://api.github.com/user', {
        headers: { 
          Authorization: `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github+json',
        }
      })
        .then(res => {
          if (!res.ok) throw new Error('Invalid token')
          return res.json()
        })
        .then(data => setGithubUser({ login: data.login, avatar_url: data.avatar_url }))
        .catch(() => {
          // Token is invalid, clear it
          setGithubToken(null)
          sessionStorage.removeItem('github_token')
        })
    }
  }, [githubToken])

  // Set default commit message when selected policy changes
  React.useEffect(() => {
    if (selected) {
      setCommitMessage(`Update ${selected} policy via RegoLab`)
    }
  }, [selected])

  const fetchRepos = React.useCallback(async () => {
    if (!githubToken) return
    
    setLoadingRepos(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/github/repos`, {
        headers: { Authorization: `Bearer ${githubToken}` }
      })
      const data = await response.json()
      
      if (data.success && Array.isArray(data.repos)) {
        // Filter to repos where user has push permission
        const pushableRepos = data.repos.filter((r: Repository) => r.permissions?.push !== false)
        setRepos(pushableRepos)
        if (pushableRepos.length > 0 && !selectedRepo) {
          setSelectedRepo(pushableRepos[0].full_name)
        }
      }
    } catch {
      toast.error("Failed to load repositories")
    } finally {
      setLoadingRepos(false)
    }
  }, [githubToken, selectedRepo])

  const fetchBranches = React.useCallback(async () => {
    if (!githubToken || !selectedRepo) return
    
    setLoadingBranches(true)
    try {
      const [owner, repo] = selectedRepo.split('/')
      const response = await fetch(`${API_BASE_URL}/api/github/repos/${owner}/${repo}/branches`, {
        headers: { Authorization: `Bearer ${githubToken}` }
      })
      const data = await response.json()
      
      if (data.success && Array.isArray(data.branches)) {
        setBranches(data.branches)
        // Set default branch
        const repoInfo = repos.find(r => r.full_name === selectedRepo)
        const defaultBranch = repoInfo?.default_branch || 'main'
        const branchExists = data.branches.some((b: Branch) => b.name === defaultBranch)
        setSelectedBranch(branchExists ? defaultBranch : data.branches[0]?.name || 'main')
      }
    } catch {
      toast.error("Failed to load branches")
    } finally {
      setLoadingBranches(false)
    }
  }, [githubToken, selectedRepo, repos])

  // Fetch repos when drawer opens and token exists
  React.useEffect(() => {
    if (open && githubToken) {
      fetchRepos()
    }
  }, [open, githubToken, fetchRepos])

  // Fetch branches when repo changes
  React.useEffect(() => {
    if (selectedRepo && githubToken) {
      fetchBranches()
    }
  }, [selectedRepo, githubToken, fetchBranches])

  const initiateGitHubAuth = () => {
    const state = crypto.randomUUID()
    sessionStorage.setItem('github_oauth_state', state)
    window.location.href = `${API_BASE_URL}/api/github/authorize?state=${state}`
  }

  const disconnectGitHub = () => {
    setGithubToken(null)
    setGithubUser(null)
    setRepos([])
    setBranches([])
    setSelectedRepo("")
    setSelectedBranch("")
    sessionStorage.removeItem('github_token')
    toast.success("Disconnected from GitHub")
  }

  const createRepository = async () => {
    if (!githubToken || !newRepoName.trim()) return
    
    setCreatingRepo(true)
    try {
      const response = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newRepoName.trim(),
          description: newRepoDescription.trim() || `Policy repository created via RegoLab`,
          private: newRepoPrivate,
          auto_init: true, // Initialize with README so we have a branch to commit to
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create repository')
      }

      const newRepo = await response.json()
      toast.success(`Repository "${newRepo.full_name}" created!`)
      
      // Refresh repos and select the new one
      await fetchRepos()
      setSelectedRepo(newRepo.full_name)
      
      // Close dialog and reset form
      setCreateRepoOpen(false)
      setNewRepoName("")
      setNewRepoDescription("")
      setNewRepoPrivate(true)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to create repository: ${message}`)
    } finally {
      setCreatingRepo(false)
    }
  }

  const handlePublish = async () => {
    if (!githubToken || !selectedRepo || !selected) return
    
    const [owner, repo] = selectedRepo.split('/')
    const basePath = path.endsWith('/') ? path : `${path}/`
    
    setPublishing(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/github/publish`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${githubToken}`,
        },
        body: JSON.stringify({
          token: githubToken,
          owner,
          repo,
          branch: selectedBranch,
          commitMessage: commitMessage || `Update ${selected} policy via RegoLab`,
          files: [
            { path: `${basePath}${selected}.rego`, content: activePolicyContent.policy },
            { path: `${basePath}input.json`, content: activePolicyContent.input },
            { path: `${basePath}data.json`, content: activePolicyContent.data },
            ...(activePolicyContent.test ? [{ path: `${basePath}${selected}_test.rego`, content: activePolicyContent.test }] : []),
          ]
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Publish failed')
      }
      
      toast.success(
        <div className="flex flex-col gap-1">
          <span>Policy published to GitHub!</span>
          <a 
            href={data.commitUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:underline"
          >
            View commit →
          </a>
        </div>
      )
      onOpenChange(false)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Publish failed: ${message}`)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <Drawer.Root direction="right" open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Content
          className="right-2 top-2 bottom-2 fixed z-60 outline-none w-[420px] flex"
          style={{ '--initial-transform': 'calc(100% + 8px)' } as React.CSSProperties}
        >
          <div className="bg-card h-full w-full grow flex flex-col overflow-clip rounded-md border border-border font-sans relative">
            {/* Header */}
            <div className="p-4 border-b border-border">
              <Drawer.Title className="text-lg font-semibold flex items-center gap-2">
                <GithubLogo weight="fill" className="w-5 h-5" />
                Export to GitHub
              </Drawer.Title>
              <p className="text-sm text-muted-foreground">Publish your policy to a GitHub repository</p>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {!githubToken ? (
                // Not connected state
                <div className="flex flex-col items-center justify-center h-full gap-6">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                    <GithubLogo weight="fill" className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="font-medium">Connect to GitHub</h3>
                    <p className="text-sm text-muted-foreground max-w-[280px]">
                      Authorize RegoLab to publish policies directly to your repositories.
                    </p>
                  </div>
                  <Button onClick={initiateGitHubAuth} className="gap-2">
                    <GithubLogo weight="fill" className="w-4 h-4" />
                    Connect GitHub Account
                  </Button>
                </div>
              ) : (
                // Connected state
                <div className="space-y-6">
                  {/* Connected user info */}
                  {githubUser && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                      <div className="flex items-center gap-3">
                        <Image 
                          src={githubUser.avatar_url} 
                          alt={githubUser.login}
                          width={32}
                          height={32}
                          className="rounded-full"
                          unoptimized
                        />
                        <div>
                          <p className="text-sm font-medium">{githubUser.login}</p>
                          <p className="text-xs text-muted-foreground">Connected</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={disconnectGitHub}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <SignOut className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {/* Repository selector */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center justify-between">
                      Repository
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setCreateRepoOpen(true)}
                          className="h-6 w-6"
                          title="Create new repository"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={fetchRepos}
                          disabled={loadingRepos}
                          className="h-6 w-6"
                          title="Refresh repositories"
                        >
                          <ArrowsClockwise className={`w-3 h-3 ${loadingRepos ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>
                    </label>
                    {loadingRepos ? (
                      <div className="h-10 flex items-center text-sm text-muted-foreground">
                        Loading repositories...
                      </div>
                    ) : repos.length === 0 ? (
                      <div className="flex flex-col gap-2">
                        <div className="text-sm text-muted-foreground">
                          No repositories found
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setCreateRepoOpen(true)}
                          className="w-fit gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Create Repository
                        </Button>
                      </div>
                    ) : (
                      <NativeSelect 
                        value={selectedRepo} 
                        onChange={(e) => setSelectedRepo(e.target.value)}
                        className="w-full"
                      >
                        {repos.map(repo => (
                          <NativeSelectOption key={repo.id} value={repo.full_name}>
                            {repo.full_name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    )}
                  </div>

                  {/* Branch selector */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <GitBranch className="w-4 h-4" />
                      Branch
                    </label>
                    {loadingBranches ? (
                      <div className="h-10 flex items-center text-sm text-muted-foreground">
                        Loading branches...
                      </div>
                    ) : (
                      <NativeSelect 
                        value={selectedBranch} 
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="w-full"
                        disabled={!selectedRepo}
                      >
                        {branches.map(branch => (
                          <NativeSelectOption key={branch.name} value={branch.name}>
                            {branch.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    )}
                  </div>

                  {/* Path input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <FolderSimple className="w-4 h-4" />
                      Path
                    </label>
                    <Input 
                      value={path} 
                      onChange={(e) => setPath(e.target.value)}
                      placeholder="policies/"
                    />
                    <p className="text-xs text-muted-foreground">
                      Files will be saved to: <code className="bg-muted px-1 rounded">{path}{selected}.rego</code>
                    </p>
                  </div>

                  {/* Commit message */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <ChatText className="w-4 h-4" />
                      Commit Message
                    </label>
                    <Input 
                      value={commitMessage} 
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder={`Update ${selected || 'policy'} via RegoLab`}
                    />
                  </div>

                  {/* Files preview */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Files to publish</label>
                    <div className="text-xs space-y-1 p-3 rounded-lg bg-muted/50 border border-border font-mono">
                      <div className="text-muted-foreground">{path}{selected}.rego</div>
                      <div className="text-muted-foreground">{path}input.json</div>
                      <div className="text-muted-foreground">{path}data.json</div>
                      {activePolicyContent.test && (
                        <div className="text-muted-foreground">{path}{selected}_test.rego</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer */}
            {githubToken && (
              <div className="mt-auto bg-card py-4 px-4 border-t border-border">
                <Button 
                  className="w-full gap-2" 
                  onClick={handlePublish} 
                  disabled={publishing || !selectedRepo || !selectedBranch || !selected}
                >
                  {publishing ? (
                    <>
                      <ArrowsClockwise className="w-4 h-4 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Publish to GitHub
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>

      {/* Create Repository Dialog */}
      <Dialog open={createRepoOpen} onOpenChange={setCreateRepoOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GithubLogo weight="fill" className="w-5 h-5" />
              Create New Repository
            </DialogTitle>
            <DialogDescription>
              Create a new GitHub repository to store your policies.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Repository Name</label>
              <Input
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
                placeholder="my-opa-policies"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (optional)</label>
              <Input
                value={newRepoDescription}
                onChange={(e) => setNewRepoDescription(e.target.value)}
                placeholder="OPA policies managed with RegoLab"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Visibility</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={newRepoPrivate ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNewRepoPrivate(true)}
                  className="flex-1 gap-2"
                >
                  <Lock className="w-4 h-4" />
                  Private
                </Button>
                <Button
                  type="button"
                  variant={!newRepoPrivate ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNewRepoPrivate(false)}
                  className="flex-1 gap-2"
                >
                  <Globe className="w-4 h-4" />
                  Public
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateRepoOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={createRepository} 
              disabled={creatingRepo || !newRepoName.trim()}
              className="gap-2"
            >
              {creatingRepo ? (
                <>
                  <ArrowsClockwise className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Repository
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Drawer.Root>
  )
}

export default ExportDrawer
