'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Trash2,
  UserCog,
  AlertTriangle,
  Mail,
  CalendarDays,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';

// ==================== TYPES ====================
interface UserRow {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  avatar?: string;
}

interface UsersResponse {
  users: UserRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ==================== CONSTANTS ====================
const ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'MODERATEUR',
  'FORMATEUR',
  'MENTOR',
  'VOLONTAIRE',
  'UTILISATEUR',
  'INTERVENANT_URGENCE',
] as const;

type RoleName = (typeof ROLES)[number];

const ROLE_BADGE_STYLES: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-800 border-red-200',
  ADMIN: 'bg-orange-100 text-orange-800 border-orange-200',
  MODERATEUR: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  FORMATEUR: 'bg-green-100 text-green-800 border-green-200',
  MENTOR: 'bg-purple-100 text-purple-800 border-purple-200',
  VOLONTAIRE: 'bg-teal-100 text-teal-800 border-teal-200',
  UTILISATEUR: 'bg-gray-100 text-gray-800 border-gray-200',
  INTERVENANT_URGENCE: 'bg-red-100 text-orange-800 border-red-200',
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MODERATEUR: 'Modérateur',
  FORMATEUR: 'Formateur',
  MENTOR: 'Mentor',
  VOLONTAIRE: 'Volontaire',
  UTILISATEUR: 'Utilisateur',
  INTERVENANT_URGENCE: 'Intervenant Urgence',
};

const PAGE_SIZE = 20;

// ==================== HELPERS ====================
function getRoleName(role: string | Record<string, unknown> | undefined): string {
  if (!role) return 'UTILISATEUR';
  if (typeof role === 'string') return role;
  if (typeof role === 'object' && role !== null && 'name' in role) {
    return String((role as Record<string, unknown>).name);
  }
  return 'UTILISATEUR';
}

function isSuperAdmin(role: string | Record<string, unknown> | undefined): boolean {
  return getRoleName(role) === 'SUPER_ADMIN';
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ==================== COMPONENT ====================
export function AccountManagementView() {
  const token = useAuthStore((s) => s.token);
  const currentUser = useAuthStore((s) => s.user);
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  // Data state
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  // Dialog state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleDialogUser, setRoleDialogUser] = useState<UserRow | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [roleSaving, setRoleSaving] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDialogUser, setDeleteDialogUser] = useState<UserRow | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const [resetPwdDialogOpen, setResetPwdDialogOpen] = useState(false);
  const [resetPwdDialogUser, setResetPwdDialogUser] = useState<UserRow | null>(null);
  const [resetPwdNewPassword, setResetPwdNewPassword] = useState('');
  const [resetPwdConfirmPassword, setResetPwdConfirmPassword] = useState('');
  const [resetPwdSaving, setResetPwdSaving] = useState(false);
  const [resetPwdShowPassword, setResetPwdShowPassword] = useState(false);

  const [toggleSavingId, setToggleSavingId] = useState<string | null>(null);

  // Derived
  const isCurrentUserSuperAdmin = isSuperAdmin(currentUser?.role);
  const isCurrentUserAdmin = isCurrentUserSuperAdmin || getRoleName(currentUser?.role) === 'ADMIN';

  // ==================== FETCH USERS ====================
  const fetchUsers = useCallback(async (targetPage?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(targetPage ?? page));
      params.set('limit', String(PAGE_SIZE));
      if (search.trim()) params.set('search', search.trim());
      if (roleFilter && roleFilter !== 'all') params.set('role', roleFilter);

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data: UsersResponse = await res.json();
        setUsers(data.users || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        toast.error('Erreur lors du chargement des utilisateurs');
        setUsers([]);
      }
    } catch {
      toast.error('Erreur réseau');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [token, page, search, roleFilter]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(PAGE_SIZE));
        if (search.trim()) params.set('search', search.trim());
        if (roleFilter && roleFilter !== 'all') params.set('role', roleFilter);

        const res = await fetch(`/api/admin/users?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!cancelled) {
          if (res.ok) {
            const data: UsersResponse = await res.json();
            setUsers(data.users || []);
            setTotal(data.total || 0);
            setTotalPages(data.totalPages || 1);
          } else {
            toast.error('Erreur lors du chargement des utilisateurs');
            setUsers([]);
          }
        }
      } catch {
        if (!cancelled) {
          toast.error('Erreur réseau');
          setUsers([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [token, page, search, roleFilter]);

  // Handlers that also reset page
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleRoleFilterChange = (value: string) => {
    setRoleFilter(value);
    setPage(1);
  };

  // ==================== ROLE CHANGE ====================
  const openRoleDialog = (user: UserRow) => {
    setRoleDialogUser(user);
    setSelectedRole(user.role);
    setRoleDialogOpen(true);
  };

  const handleRoleChange = async () => {
    if (!roleDialogUser || !selectedRole) return;

    // Protection: only SUPER_ADMIN can assign ADMIN or SUPER_ADMIN
    if (
      (selectedRole === 'ADMIN' || selectedRole === 'SUPER_ADMIN') &&
      !isCurrentUserSuperAdmin
    ) {
      toast.error('Seul un Super Admin peut attribuer le rôle Admin ou Super Admin');
      return;
    }

    setRoleSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: roleDialogUser.id,
          role: selectedRole,
        }),
      });

      if (res.ok) {
        toast.success(`Rôle de ${roleDialogUser.name} modifié en ${ROLE_LABELS[selectedRole] || selectedRole}`);
        setRoleDialogOpen(false);
        fetchUsers();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Erreur lors du changement de rôle');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setRoleSaving(false);
    }
  };

  // ==================== TOGGLE ACTIVE ====================
  const handleToggleActive = async (user: UserRow) => {
    // Self-protection: cannot deactivate yourself
    if (user.id === currentUser?.id && user.isActive) {
      toast.error('Vous ne pouvez pas désactiver votre propre compte');
      return;
    }

    const newStatus = !user.isActive;
    setToggleSavingId(user.id);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: user.id,
          isActive: newStatus,
        }),
      });

      if (res.ok) {
        toast.success(
          newStatus
            ? `${user.name} a été activé`
            : `${user.name} a été désactivé`
        );
        fetchUsers();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Erreur lors du changement de statut');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setToggleSavingId(null);
    }
  };

  // ==================== DELETE USER ====================
  const openDeleteDialog = (user: UserRow) => {
    setDeleteDialogUser(user);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteDialogUser) return;

    setDeleteSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: deleteDialogUser.id,
        }),
      });

      if (res.ok) {
        toast.success(`Compte de ${deleteDialogUser.name} supprimé`);
        setDeleteDialogOpen(false);
        fetchUsers();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Erreur lors de la suppression');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setDeleteSaving(false);
    }
  };

  // ==================== RESET PASSWORD ====================
  const openResetPwdDialog = (user: UserRow) => {
    setResetPwdDialogUser(user);
    setResetPwdNewPassword('');
    setResetPwdConfirmPassword('');
    setResetPwdShowPassword(false);
    setResetPwdDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetPwdDialogUser) return;

    if (!resetPwdNewPassword || resetPwdNewPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (resetPwdNewPassword !== resetPwdConfirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    setResetPwdSaving(true);
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: resetPwdDialogUser.id,
          newPassword: resetPwdNewPassword,
        }),
      });

      if (res.ok) {
        toast.success(`Mot de passe de ${resetPwdDialogUser.name} réinitialisé avec succès`);
        setResetPwdDialogOpen(false);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Erreur lors de la réinitialisation');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setResetPwdSaving(false);
    }
  };

  // ==================== ROLE BADGE ====================
  const renderRoleBadge = (role: string) => {
    const badgeStyle = ROLE_BADGE_STYLES[role] || ROLE_BADGE_STYLES['UTILISATEUR'];
    const label = ROLE_LABELS[role] || role;
    return (
      <Badge className={`${badgeStyle} border text-xs font-medium`} variant="outline">
        {label}
      </Badge>
    );
  };

  // ==================== STATUS BADGE ====================
  const renderStatusBadge = (isActive: boolean) => (
    <Badge
      className={`border text-xs font-medium ${
        isActive
          ? 'bg-green-100 text-green-800 border-green-200'
          : 'bg-gray-100 text-gray-600 border-gray-200'
      }`}
      variant="outline"
    >
      {isActive ? 'Actif' : 'Inactif'}
    </Badge>
  );

  // ==================== SKELETON ====================
  const renderSkeleton = () => {
    if (isMobile) {
      return Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            </div>
          </div>
        </Card>
      ));
    }
    return Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
        <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
        <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-8 w-24" /></TableCell>
      </TableRow>
    ));
  };

  // ==================== EMPTY STATE ====================
  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
      <p className="text-muted-foreground font-medium">Aucun utilisateur trouvé</p>
      <p className="text-sm text-muted-foreground/70 mt-1">
        Essayez de modifier vos critères de recherche
      </p>
    </div>
  );

  // ==================== PAGINATION ====================
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between px-2 py-4">
        <p className="text-sm text-muted-foreground">
          {total} utilisateur{total > 1 ? 's' : ''} au total — Page {page} / {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }).map((_, idx) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = idx + 1;
              } else if (page <= 3) {
                pageNum = idx + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + idx;
              } else {
                pageNum = page - 2 + idx;
              }
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="gap-1"
          >
            Suivant
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  // ==================== MOBILE PAGINATION ====================
  const renderMobilePagination = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between px-2 py-3">
        <p className="text-xs text-muted-foreground">
          {total} résultat{total > 1 ? 's' : ''} — Page {page}/{totalPages}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[60px] text-center">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  // ==================== MOBILE CARD ====================
  const renderMobileCard = (user: UserRow) => {
    const isSelf = user.id === currentUser?.id;
    const isTargetAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    const canDelete = isCurrentUserAdmin && !isSelf && (isCurrentUserSuperAdmin || !isTargetAdmin);

    return (
      <Card key={user.id} className="p-4 gap-0">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-weds-blue-100 flex items-center justify-center shrink-0">
            <span className="text-weds-blue-700 font-bold text-sm">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm truncate">{user.name}</p>
              {isSelf && (
                <Badge className="bg-weds-blue-100 text-weds-blue-700 border-0 text-[10px]">
                  Vous
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {renderRoleBadge(user.role)}
              {renderStatusBadge(user.isActive)}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {formatDate(user.createdAt)}
            </div>
          </div>
        </div>
        {/* Mobile Actions */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => openRoleDialog(user)}
          >
            <UserCog className="h-3 w-3" />
            Rôle
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => openResetPwdDialog(user)}
          >
            <KeyRound className="h-3 w-3" />
            Mdp
          </Button>
          <div className="flex items-center gap-2">
            <Switch
              checked={user.isActive}
              disabled={toggleSavingId === user.id || (isSelf && user.isActive)}
              onCheckedChange={() => handleToggleActive(user)}
              className="data-[state=checked]:bg-green-600"
            />
            <span className="text-xs text-muted-foreground">
              {user.isActive ? 'Actif' : 'Inactif'}
            </span>
          </div>
          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 text-weds-red hover:bg-weds-red-50 hover:text-weds-red border-weds-red/30 ml-auto"
              onClick={() => openDeleteDialog(user)}
            >
              <Trash2 className="h-3 w-3" />
              Supprimer
            </Button>
          )}
        </div>
      </Card>
    );
  };

  // ==================== DESKTOP TABLE ====================
  const renderDesktopTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Rôle</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Inscription</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          renderSkeleton()
        ) : users.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6}>{renderEmpty()}</TableCell>
          </TableRow>
        ) : (
          users.map((user) => {
            const isSelf = user.id === currentUser?.id;
            const isTargetAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
            const canDelete = isCurrentUserAdmin && !isSelf && (isCurrentUserSuperAdmin || !isTargetAdmin);

            return (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-weds-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-weds-blue-700 font-bold text-xs">
                        {user.name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{user.name}</p>
                      {isSelf && (
                        <span className="text-[10px] text-weds-blue">Vous</span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {user.email}
                </TableCell>
                <TableCell>{renderRoleBadge(user.role)}</TableCell>
                <TableCell>{renderStatusBadge(user.isActive)}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(user.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => openRoleDialog(user)}
                    >
                      <ShieldCheck className="h-3 w-3" />
                      Rôle
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => openResetPwdDialog(user)}
                      title="Réinitialiser le mot de passe"
                    >
                      <KeyRound className="h-3 w-3" />
                    </Button>
                    <Switch
                      checked={user.isActive}
                      disabled={toggleSavingId === user.id || (isSelf && user.isActive)}
                      onCheckedChange={() => handleToggleActive(user)}
                      className="data-[state=checked]:bg-green-600"
                    />
                    {canDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 text-weds-red hover:bg-weds-red-50 hover:text-weds-red border-weds-red/30"
                        onClick={() => openDeleteDialog(user)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );

  // ==================== MAIN RENDER ====================
  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-weds-blue-800 dark:text-weds-blue-100">
          Gestion des comptes
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Gérez les utilisateurs, leurs rôles et statuts
        </p>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, email ou téléphone..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={roleFilter}
              onValueChange={(val) => handleRoleFilterChange(val)}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtrer par rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table / Cards */}
      <Card>
        <CardContent className="p-0">
          {isMobile ? (
            <div className="p-4 space-y-3">
              {loading ? (
                renderSkeleton()
              ) : users.length === 0 ? (
                renderEmpty()
              ) : (
                users.map((user) => renderMobileCard(user))
              )}
              {renderMobilePagination()}
            </div>
          ) : (
            <>
              {renderDesktopTable()}
              <div className="px-4">{renderPagination()}</div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ==================== ROLE CHANGE DIALOG ==================== */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-weds-blue" />
              Changer le rôle
            </DialogTitle>
            <DialogDescription>
              Modifiez le rôle de l&apos;utilisateur
            </DialogDescription>
          </DialogHeader>

          {roleDialogUser && (
            <div className="space-y-4 py-2">
              {/* User info */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <div className="w-10 h-10 rounded-full bg-weds-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-weds-blue-700 font-bold text-sm">
                    {roleDialogUser.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{roleDialogUser.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    <Mail className="h-3 w-3 inline mr-1" />
                    {roleDialogUser.email}
                  </p>
                </div>
              </div>

              {/* Current role */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rôle actuel :</span>
                {renderRoleBadge(roleDialogUser.role)}
              </div>

              {/* New role selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Nouveau rôle</label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner un rôle" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => {
                      // Only SUPER_ADMIN can assign ADMIN or SUPER_ADMIN
                      const isRestricted = (role === 'ADMIN' || role === 'SUPER_ADMIN') && !isCurrentUserSuperAdmin;
                      return (
                        <SelectItem
                          key={role}
                          value={role}
                          disabled={isRestricted}
                        >
                          <div className="flex items-center gap-2">
                            {ROLE_LABELS[role]}
                            {isRestricted && (
                              <span className="text-[10px] text-weds-red">(Super Admin uniquement)</span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Warning for restricted roles */}
              {(selectedRole === 'ADMIN' || selectedRole === 'SUPER_ADMIN') && !isCurrentUserSuperAdmin && (
                <div className="flex items-start gap-2 p-3 bg-weds-red-50 border border-weds-red/20 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-weds-red shrink-0 mt-0.5" />
                  <p className="text-xs text-weds-red">
                    Seul un Super Admin peut attribuer le rôle {ROLE_LABELS[selectedRole]}.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleDialogOpen(false)}
              disabled={roleSaving}
            >
              Annuler
            </Button>
            <Button
              onClick={handleRoleChange}
              disabled={roleSaving || !selectedRole || selectedRole === roleDialogUser?.role}
              className="bg-weds-blue hover:bg-weds-blue-700 text-white"
            >
              {roleSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DELETE CONFIRMATION DIALOG ==================== */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-weds-red">
              <Trash2 className="h-5 w-5" />
              Supprimer le compte
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le compte et toutes les données associées seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteDialogUser && (
            <div className="flex items-center gap-3 p-3 bg-weds-red-50 border border-weds-red/20 rounded-lg my-2">
              <div className="w-10 h-10 rounded-full bg-weds-red-100 flex items-center justify-center shrink-0">
                <span className="text-weds-red font-bold text-sm">
                  {deleteDialogUser.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div>
                <p className="font-medium text-sm">{deleteDialogUser.name}</p>
                <p className="text-xs text-muted-foreground">{deleteDialogUser.email}</p>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSaving}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteSaving}
              className="bg-weds-red text-white hover:bg-weds-red-light"
            >
              {deleteSaving ? 'Suppression...' : 'Supprimer définitivement'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ==================== RESET PASSWORD DIALOG ==================== */}
      <Dialog open={resetPwdDialogOpen} onOpenChange={setResetPwdDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-weds-blue" />
              Réinitialiser le mot de passe
            </DialogTitle>
            <DialogDescription>
              Définissez un nouveau mot de passe pour cet utilisateur
            </DialogDescription>
          </DialogHeader>

          {resetPwdDialogUser && (
            <div className="space-y-4 py-2">
              {/* User info */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <div className="w-10 h-10 rounded-full bg-weds-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-weds-blue-700 font-bold text-sm">
                    {resetPwdDialogUser.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{resetPwdDialogUser.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    <Mail className="h-3 w-3 inline mr-1" />
                    {resetPwdDialogUser.email}
                  </p>
                </div>
              </div>

              {/* New password */}
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="new-pwd">Nouveau mot de passe</label>
                <div className="relative">
                  <Input
                    id="new-pwd"
                    type={resetPwdShowPassword ? 'text' : 'password'}
                    placeholder="Minimum 6 caractères"
                    value={resetPwdNewPassword}
                    onChange={(e) => setResetPwdNewPassword(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setResetPwdShowPassword(!resetPwdShowPassword)}
                  >
                    {resetPwdShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {resetPwdNewPassword && resetPwdNewPassword.length < 6 && (
                  <p className="text-xs text-weds-red">Le mot de passe doit contenir au moins 6 caractères</p>
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="confirm-pwd">Confirmer le mot de passe</label>
                <Input
                  id="confirm-pwd"
                  type={resetPwdShowPassword ? 'text' : 'password'}
                  placeholder="Confirmez le mot de passe"
                  value={resetPwdConfirmPassword}
                  onChange={(e) => setResetPwdConfirmPassword(e.target.value)}
                />
                {resetPwdConfirmPassword && resetPwdNewPassword !== resetPwdConfirmPassword && (
                  <p className="text-xs text-weds-red">Les mots de passe ne correspondent pas</p>
                )}
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  L&apos;utilisateur devra utiliser ce nouveau mot de passe pour se connecter. Assurez-vous de lui communiquer de manière sécurisée.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetPwdDialogOpen(false)}
              disabled={resetPwdSaving}
            >
              Annuler
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={
                resetPwdSaving ||
                !resetPwdNewPassword ||
                resetPwdNewPassword.length < 6 ||
                resetPwdNewPassword !== resetPwdConfirmPassword
              }
              className="bg-weds-blue hover:bg-weds-blue-700 text-white"
            >
              {resetPwdSaving ? 'Enregistrement...' : 'Réinitialiser'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
