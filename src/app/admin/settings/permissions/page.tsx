"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { PERMISSIONS } from "../../../../../convex/permissions";
import type { Permission } from "../../../../../convex/permissions";
import { useOrg } from "@/hooks/use-org";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shield, Save, CalendarDays, Newspaper, Ticket, LayoutDashboard, Building2, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PermissionInfo {
  label: string;
  description: string;
  supersedes?: Permission;
}

const PERMISSION_META: Record<Permission, PermissionInfo> = {
  [PERMISSIONS.EVENTS_SUBMIT]: {
    label: "Submit Events",
    description: "Submit events for admin approval before publishing",
  },
  [PERMISSIONS.EVENTS_CREATE]: {
    label: "Create Events (Auto-Approved)",
    description: "Create events that publish immediately without approval",
    supersedes: PERMISSIONS.EVENTS_SUBMIT,
  },
  [PERMISSIONS.EVENTS_UPDATE_OWN]: {
    label: "Edit Own Events",
    description: "Edit events they previously submitted",
  },
  [PERMISSIONS.EVENTS_DELETE_OWN]: {
    label: "Delete Own Events",
    description: "Remove events they previously submitted",
  },
  [PERMISSIONS.EVENTS_MANAGE_ALL]: {
    label: "Edit Any Event",
    description: "Edit or delete any event in the calendar, not only their own",
  },
  [PERMISSIONS.EVENTS_APPROVE]: {
    label: "Approve Events",
    description: "Review and approve/reject submitted events",
  },
  [PERMISSIONS.BLOG_SUBMIT]: {
    label: "Submit Posts",
    description: "Submit blog posts for admin approval",
  },
  [PERMISSIONS.BLOG_CREATE]: {
    label: "Create Posts (Auto-Approved)",
    description: "Create blog posts that publish immediately",
    supersedes: PERMISSIONS.BLOG_SUBMIT,
  },
  [PERMISSIONS.BLOG_UPDATE_OWN]: {
    label: "Edit Own Posts",
    description: "Edit blog posts they previously submitted",
  },
  [PERMISSIONS.BLOG_DELETE_OWN]: {
    label: "Delete Own Posts",
    description: "Remove blog posts they previously submitted",
  },
  [PERMISSIONS.BLOG_APPROVE]: {
    label: "Approve Posts",
    description: "Review and approve/reject submitted blog posts",
  },
  [PERMISSIONS.VIDEOS_SUBMIT]: {
    label: "Submit Videos",
    description: "Submit videos for admin approval before publishing",
  },
  [PERMISSIONS.VIDEOS_CREATE]: {
    label: "Create Videos (Auto-Approved)",
    description: "Create videos that publish immediately without approval",
    supersedes: PERMISSIONS.VIDEOS_SUBMIT,
  },
  [PERMISSIONS.VIDEOS_UPDATE_OWN]: {
    label: "Edit Own Videos",
    description: "Edit videos they previously submitted",
  },
  [PERMISSIONS.VIDEOS_DELETE_OWN]: {
    label: "Delete Own Videos",
    description: "Remove videos they previously submitted",
  },
  [PERMISSIONS.VIDEOS_APPROVE]: {
    label: "Approve Videos",
    description: "Review and approve/reject submitted videos",
  },
  [PERMISSIONS.COUPONS_CLAIM]: {
    label: "Claim Coupons",
    description: "Claim available coupons and deals",
  },
  [PERMISSIONS.PORTAL_VIEW]: {
    label: "View Portal",
    description: "Access the client portal dashboard",
  },
  [PERMISSIONS.PORTAL_ASSETS]: {
    label: "Upload Assets",
    description: "Upload ad artwork and assets for review",
  },
  [PERMISSIONS.PORTAL_MESSAGES]: {
    label: "Send Messages",
    description: "Send messages to the admin team",
  },
  [PERMISSIONS.PORTAL_PAYMENTS]: {
    label: "View Payments",
    description: "View payment history and balances",
  },
  [PERMISSIONS.PORTAL_INVOICES]: {
    label: "View Invoices",
    description: "View and download invoices",
  },
  [PERMISSIONS.PORTAL_PLACEMENTS]: {
    label: "Request Placements",
    description: "Browse and request ad placements",
  },
  [PERMISSIONS.DIRECTORY_CLAIM]: {
    label: "Claim Listing",
    description: "Claim a business directory listing",
  },
};

interface DomainGroup {
  label: string;
  icon: React.ReactNode;
  permissions: Permission[];
}

const DOMAIN_GROUPS: DomainGroup[] = [
  {
    label: "Events",
    icon: <CalendarDays className="h-4 w-4" />,
    permissions: [
      PERMISSIONS.EVENTS_SUBMIT,
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.EVENTS_UPDATE_OWN,
      PERMISSIONS.EVENTS_DELETE_OWN,
      PERMISSIONS.EVENTS_APPROVE,
    ],
  },
  {
    label: "Blog",
    icon: <Newspaper className="h-4 w-4" />,
    permissions: [
      PERMISSIONS.BLOG_SUBMIT,
      PERMISSIONS.BLOG_CREATE,
      PERMISSIONS.BLOG_UPDATE_OWN,
      PERMISSIONS.BLOG_DELETE_OWN,
      PERMISSIONS.BLOG_APPROVE,
    ],
  },
  {
    label: "Videos",
    icon: <Video className="h-4 w-4" />,
    permissions: [
      PERMISSIONS.VIDEOS_SUBMIT,
      PERMISSIONS.VIDEOS_CREATE,
      PERMISSIONS.VIDEOS_UPDATE_OWN,
      PERMISSIONS.VIDEOS_DELETE_OWN,
      PERMISSIONS.VIDEOS_APPROVE,
    ],
  },
  {
    label: "Coupons & Directory",
    icon: <Ticket className="h-4 w-4" />,
    permissions: [
      PERMISSIONS.COUPONS_CLAIM,
      PERMISSIONS.DIRECTORY_CLAIM,
    ],
  },
  {
    label: "Client Portal",
    icon: <LayoutDashboard className="h-4 w-4" />,
    permissions: [
      PERMISSIONS.PORTAL_VIEW,
      PERMISSIONS.PORTAL_ASSETS,
      PERMISSIONS.PORTAL_MESSAGES,
      PERMISSIONS.PORTAL_PAYMENTS,
      PERMISSIONS.PORTAL_INVOICES,
      PERMISSIONS.PORTAL_PLACEMENTS,
    ],
  },
];

const CONTACT_DOMAINS = ["Events", "Blog", "Videos", "Client Portal"];
const USER_DOMAINS = ["Events", "Blog", "Videos", "Coupons & Directory"];

function PermissionToggle({
  permission,
  enabled,
  superseded,
  onToggle,
}: {
  permission: Permission;
  enabled: boolean;
  superseded: boolean;
  onToggle: (permission: Permission, enabled: boolean) => void;
}) {
  const info = PERMISSION_META[permission];
  return (
    <div className={`flex items-center justify-between rounded-lg border p-3 ${superseded ? "opacity-50" : ""}`}>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">{info.label}</Label>
          {superseded && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              included
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{info.description}</p>
      </div>
      <Switch
        checked={enabled || superseded}
        disabled={superseded}
        onCheckedChange={(checked) => onToggle(permission, checked)}
      />
    </div>
  );
}

function DomainSection({
  group,
  availablePermissions,
  activePerms,
  onToggle,
}: {
  group: DomainGroup;
  availablePermissions: Permission[];
  activePerms: string[];
  onToggle: (permission: Permission, enabled: boolean) => void;
}) {
  const filtered = group.permissions.filter((p) => availablePermissions.includes(p));
  if (filtered.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {group.icon}
        {group.label}
      </div>
      {filtered.map((perm) => {
        const isSuperseded = Object.entries(PERMISSION_META).some(
          ([key, meta]) => meta.supersedes === perm && activePerms.includes(key)
        );

        return (
          <PermissionToggle
            key={perm}
            permission={perm}
            enabled={activePerms.includes(perm)}
            superseded={isSuperseded}
            onToggle={onToggle}
          />
        );
      })}
    </div>
  );
}

export default function PermissionsSettingsPage() {
  const { isReady } = useOrg();

  const defaults = useQuery(
    api.orgPermissions.queries.getDefaults,
    isReady ? {} : "skip"
  );
  const ensureDefaults = useMutation(api.orgPermissions.mutations.ensureDefaults);
  const updateDefaults = useMutation(api.orgPermissions.mutations.updateDefaults);

  const [contactPerms, setContactPerms] = useState<string[]>([]);
  const [userPerms, setUserPerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (isReady && defaults === null) {
      ensureDefaults({});
    }
  }, [isReady, defaults, ensureDefaults]);

  useEffect(() => {
    if (defaults && !initialized) {
      setContactPerms(defaults.contactDefaults);
      setUserPerms(defaults.userDefaults);
      setInitialized(true);
    }
  }, [defaults, initialized]);

  const handleContactToggle = useCallback((permission: Permission, enabled: boolean) => {
    setContactPerms((prev) =>
      enabled ? [...prev, permission] : prev.filter((p) => p !== permission)
    );
  }, []);

  const handleUserToggle = useCallback((permission: Permission, enabled: boolean) => {
    setUserPerms((prev) =>
      enabled ? [...prev, permission] : prev.filter((p) => p !== permission)
    );
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDefaults({
        contactDefaults: contactPerms,
        userDefaults: userPerms,
      });
      toast.success("Permission defaults saved");
    } catch {
      toast.error("Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  if (!isReady || defaults === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const contactAllowed = DOMAIN_GROUPS
    .filter((g) => CONTACT_DOMAINS.includes(g.label))
    .flatMap((g) => g.permissions)
    .filter((p) => !p.endsWith(":approve")) as Permission[];

  const userAllowed = DOMAIN_GROUPS
    .filter((g) => USER_DOMAINS.includes(g.label))
    .flatMap((g) => g.permissions)
    .filter((p) => !p.endsWith(":approve")) as Permission[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Permissions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure default permissions for contacts and public users.
            Individual permissions can be overridden per user.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Contact Defaults
          </CardTitle>
          <CardDescription>
            Permissions granted to advertisers/clients when they access the portal.
            These apply unless a contact has custom permissions set.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {DOMAIN_GROUPS.filter((g) => CONTACT_DOMAINS.includes(g.label)).map((group) => (
            <DomainSection
              key={group.label}
              group={group}
              availablePermissions={contactAllowed}
              activePerms={contactPerms}
              onToggle={handleContactToggle}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Public User Defaults
          </CardTitle>
          <CardDescription>
            Permissions granted to community members who sign up on the public site.
            Controls what actions signed-in visitors can perform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {DOMAIN_GROUPS.filter((g) => USER_DOMAINS.includes(g.label)).map((group) => (
            <DomainSection
              key={group.label}
              group={group}
              availablePermissions={userAllowed}
              activePerms={userPerms}
              onToggle={handleUserToggle}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
