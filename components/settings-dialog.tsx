"use client"

import * as React from "react"
import { UserCircle, Palette, CreditCard } from "lucide-react"
import { Theme, useTheme } from "@/app/contexts/theme-context"
import { useUserProfile } from "@/lib/hooks/useUserProfile"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"

interface SettingsDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const sections = [
  {
    id: "account",
    name: "Account",
    icon: UserCircle,
    component: function AccountSection() {
      const { profile: userProfile, loading: profileLoading, updateProfile } = useUserProfile()
      const [isEditing, setIsEditing] = React.useState(false)
      const [editName, setEditName] = React.useState("")
      const [editAvatarUrl, setEditAvatarUrl] = React.useState("")
      const [isSaving, setIsSaving] = React.useState(false)

      React.useEffect(() => {
        if (userProfile) {
          setEditName(userProfile.name || "")
          setEditAvatarUrl(userProfile.avatar_url || "")
        }
      }, [userProfile])

      const handleSave = async () => {
        if (!userProfile) return

        try {
          setIsSaving(true)
          await updateProfile({
            name: editName.trim() || undefined,
            avatar_url: editAvatarUrl.trim() || undefined
          })
          setIsEditing(false)
        } catch (error) {
          console.error('Failed to update profile:', error)
        } finally {
          setIsSaving(false)
        }
      }

      const handleCancel = () => {
        setEditName(userProfile?.name || "")
        setEditAvatarUrl(userProfile?.avatar_url || "")
        setIsEditing(false)
      }

      return (
        <div className="space-y-6 p-6 pt-0">
          <div>
            <h3 className="text-lg font-medium">Account Information</h3>
            <p className="text-sm text-muted-foreground">
              Your account details and preferences.
            </p>
          </div>
          <Separator />
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              {userProfile ? (
                <div className="text-sm text-muted-foreground">{userProfile.email}</div>
              ) : (
                <Skeleton className="h-5 w-[200px]" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              {userProfile ? (
                isEditing ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter your name"
                  />
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {userProfile.name || 'Not set'}
                  </div>
                )
              ) : (
                <Skeleton className="h-5 w-[150px]" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Avatar URL</Label>
              {userProfile ? (
                isEditing ? (
                  <Input
                    value={editAvatarUrl}
                    onChange={(e) => setEditAvatarUrl(e.target.value)}
                    placeholder="Enter avatar URL"
                  />
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {userProfile.avatar_url || 'Not set'}
                  </div>
                )
              ) : (
                <Skeleton className="h-5 w-[150px]" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Account Type</Label>
              <div className="text-sm text-muted-foreground">
                Backend Account
              </div>
            </div>
            <div className="space-y-2">
              <Label>Member Since</Label>
              {userProfile ? (
                <div className="text-sm text-muted-foreground">
                  {new Date(userProfile.created_at).toLocaleDateString()}
                </div>
              ) : (
                <Skeleton className="h-5 w-[120px]" />
              )}
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    size="sm"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSaving}
                    size="sm"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setIsEditing(true)}
                  disabled={profileLoading}
                  size="sm"
                >
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </div>
      )
    }
  },
  {
    id: "appearance",
    name: "Appearance",
    icon: Palette,
    component: function AppearanceSection() {
      const { theme, setTheme } = useTheme()
      
      return (
        <div className="space-y-6 p-6 pt-0">
          <div>
            <h3 className="text-lg font-medium">Appearance</h3>
            <p className="text-sm text-muted-foreground">
              Customize how the app looks on your device.
            </p>
          </div>
          <Separator />
          <div className="space-y-4">
            <div className="space-y-4">
              <Label>Theme</Label>
              <RadioGroup
                defaultValue={theme}
                onValueChange={(value: Theme) => setTheme(value)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="light" id="light" />
                  <Label htmlFor="light">Light</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dark" id="dark" />
                  <Label htmlFor="dark">Dark</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="system" id="system" />
                  <Label htmlFor="system">System</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </div>
      )
    }
  },
  {
    id: "subscription",
    name: "Subscription",
    icon: CreditCard,
    component: function SubscriptionSection() {
      return (
        <div className="space-y-6 p-6 pt-0">
          <div>
            <h3 className="text-lg font-medium">Subscription</h3>
            <p className="text-sm text-muted-foreground">
              Manage your subscription and billing.
            </p>
          </div>
          <Separator />
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="space-y-3">
                <h4 className="font-medium">Free Plan</h4>
                <p className="text-sm text-muted-foreground">
                  You're currently on the free plan. Upgrade to get access to premium features.
                </p>
                <Button>
                  Upgrade to Pro
                </Button>
              </div>
            </div>
          </div>
        </div>
      )
    }
  }
] as const

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeSection, setActiveSection] = React.useState<typeof sections[number]["id"]>(sections[0].id)
  const ActiveComponent = sections.find(s => s.id === activeSection)?.component

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 md:max-h-[600px] md:max-w-[700px] lg:max-w-[800px]">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Customize your settings here.
        </DialogDescription>
        <SidebarProvider className="items-start">
          <Sidebar collapsible="none" className="hidden md:flex">
            <SidebarContent>
              <h1 className="text-2xl font-bold w-full pt-4 px-4">Settings</h1>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {sections.map((section) => (
                      <SidebarMenuItem key={section.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={section.id === activeSection}
                          onClick={() => setActiveSection(section.id)}
                        >
                          <button className="w-full">
                            <section.icon className="size-4" />
                            <span>{section.name}</span>
                          </button>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex h-[580px] flex-1 flex-col overflow-hidden pt-1">
            <header className="flex h-14 shrink-0 items-center gap-2">
              <div className="flex items-center gap-2 px-4">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink>Settings</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>
                        {sections.find(s => s.id === activeSection)?.name}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto">
              {ActiveComponent && <ActiveComponent />}
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}
