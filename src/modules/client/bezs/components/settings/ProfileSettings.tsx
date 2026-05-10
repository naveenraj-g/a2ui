"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authClient } from "@/modules/client/auth/betterauth/auth-client";
import { User } from "@/modules/server/auth/types";
import { Loader2, Link2, Unlink, UserCircle, AtSign, Trash2, Globe } from "lucide-react";

type Account = {
  id: string;
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
  accountId: string;
  scopes: string[];
};

const SOCIAL_PROVIDERS = [
  { id: "google", label: "Google", Icon: Globe },
  { id: "github", label: "GitHub", Icon: Link2 },
];

export default function ProfileSettings({ user }: { user: User }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [name, setName] = useState(user.name ?? "");
  const [image, setImage] = useState(user.image ?? "");
  const [profilePending, setProfilePending] = useState(false);

  const [username, setUsername] = useState(user.username ?? "");
  const [usernameError, setUsernameError] = useState("");
  const [usernamePending, setUsernamePending] = useState(false);

  useEffect(() => {
    authClient.listAccounts().then(({ data }) => {
      if (data) setAccounts(data as unknown as Account[]);
      setAccountsLoading(false);
    });
  }, []);

  const credentialAccount = accounts.find((a) => a.providerId === "credential");
  const hasCredentials = !!credentialAccount;

  async function onProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setProfilePending(true);
    const { error } = await (authClient as any).updateUser({
      name,
      image: image || undefined,
    });
    setProfilePending(false);
    if (error) {
      toast.error(error.message ?? "Failed to update profile.");
    } else {
      toast.success("Profile updated.");
      router.refresh();
    }
  }

  async function onUsernameSubmit(e: FormEvent) {
    e.preventDefault();
    setUsernameError("");
    if (username.length < 3) {
      setUsernameError("Username must be at least 3 characters");
      return;
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      setUsernameError("Only lowercase letters, numbers, and underscores");
      return;
    }
    setUsernamePending(true);
    const { error } = await (authClient as any).updateUser({ username });
    setUsernamePending(false);
    if (error) {
      toast.error(error.message ?? "Failed to update username.");
    } else {
      toast.success("Username updated.");
      router.refresh();
    }
  }

  async function handleLink(provider: "google" | "github") {
    setLinkingProvider(provider);
    await authClient.linkSocial({ provider, callbackURL: "/bezs/settings/profile" });
    setLinkingProvider(null);
  }

  async function handleUnlink(provider: string) {
    setUnlinkingProvider(provider);
    const { error } = await authClient.unlinkAccount({ providerId: provider });
    if (error) {
      toast.error(error.message ?? "Failed to unlink account.");
    } else {
      toast.success(`${provider} unlinked.`);
      setAccounts((prev) => prev.filter((a) => a.providerId !== provider));
    }
    setUnlinkingProvider(null);
  }

  async function handleDelete() {
    setIsDeleting(true);
    const { error } = await authClient.deleteUser(
      hasCredentials
        ? { password: deletePassword, callbackURL: "/goodbye" }
        : { callbackURL: "/goodbye" },
    );
    if (error) {
      toast.error(error.message ?? "Failed to delete account.");
    } else {
      toast.success("A confirmation email has been sent.");
    }
    setIsDeleting(false);
  }

  const initials = (user.name ?? "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <UserCircle className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Profile</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Manage your personal information and connected accounts.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your display name and avatar.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="size-16">
                <AvatarImage src={user.image ?? undefined} />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <form onSubmit={onProfileSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="avatar-url">Avatar URL</Label>
                <Input
                  id="avatar-url"
                  placeholder="https://..."
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={profilePending} className="w-full sm:w-auto">
                {profilePending && <Loader2 className="size-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AtSign className="size-4 text-muted-foreground" />
              <CardTitle>Username</CardTitle>
            </div>
            <CardDescription>Your unique username used to identify your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onUsernameSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                  <Input
                    id="username"
                    className="pl-7"
                    placeholder="yourname"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                {usernameError && <p className="text-sm text-destructive">{usernameError}</p>}
              </div>
              <Button type="submit" disabled={usernamePending} className="w-full sm:w-auto">
                {usernamePending && <Loader2 className="size-4 mr-2 animate-spin" />}
                Update Username
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Link2 className="size-4 text-muted-foreground" />
              <CardTitle>Connected Accounts</CardTitle>
            </div>
            <CardDescription>Link social accounts for faster sign-in.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {accountsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))
            ) : (
              <>
                {SOCIAL_PROVIDERS.map(({ id, label, Icon }) => {
                  const linked = accounts.find((a) => a.providerId === id);
                  const isUnlinking = unlinkingProvider === id;
                  const isLinking = linkingProvider === id;
                  return (
                    <div key={id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Icon className="size-5 text-foreground/70" />
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground">
                            {linked ? "Connected" : "Not connected"}
                          </p>
                        </div>
                      </div>
                      {linked ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          disabled={isUnlinking}
                          onClick={() => handleUnlink(id)}
                        >
                          {isUnlinking ? <Loader2 className="size-3 animate-spin" /> : <><Unlink className="size-3 mr-1.5" />Unlink</>}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled={isLinking} onClick={() => handleLink(id as "google" | "github")}>
                          {isLinking ? <Loader2 className="size-3 animate-spin" /> : <><Link2 className="size-3 mr-1.5" />Link</>}
                        </Button>
                      )}
                    </div>
                  );
                })}

                {credentialAccount && (
                  <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-5 items-center justify-center">
                        <span className="text-base">✉</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Email & Password</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">Active</Badge>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trash2 className="size-4 text-destructive" />
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </div>
            <CardDescription>
              Permanently delete your account. This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">Delete Account</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your account and all associated data. A confirmation email will be sent before deletion.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {hasCredentials && (
                  <div className="space-y-1.5 py-2">
                    <Label htmlFor="del-password" className="text-sm">Confirm with your password</Label>
                    <Input
                      id="del-password"
                      type="password"
                      placeholder="••••••••"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                    />
                  </div>
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeleting || (hasCredentials && !deletePassword)}
                    onClick={handleDelete}
                  >
                    {isDeleting ? <Loader2 className="size-4 animate-spin" /> : "Yes, delete my account"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
