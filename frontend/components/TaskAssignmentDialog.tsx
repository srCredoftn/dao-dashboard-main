import { useState, useEffect } from "react";
import { Users, X, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { authService } from "@/services/authService";
import { useAuth } from "@/contexts/AuthContext";
import { type TeamMember, type User } from "@shared/dao";

// Helper function to determine if a user should be available for task assignment
const isValidTaskAssignee = (member: TeamMember): boolean => {
  // Only allow assignment to users who are explicitly part of the DAO team
  // Exclude system/admin users unless they were explicitly added as team members
  return (
    (member.role === "chef_equipe" || member.role === "membre_equipe") &&
    Boolean(member.email) &&
    // Exclude admin users that weren't explicitly added to this DAO team
    // Admin users should only appear if they were specifically selected during DAO creation
    !member.name.startsWith("Admin ")
  );
};

interface TaskAssignmentDialogProps {
  currentAssignedTo?: string;
  availableMembers: TeamMember[];
  onAssignmentChange: (memberId?: string) => void;
  onTeamUpdate?: (newTeam: TeamMember[]) => void;
  taskName: string;
  canManage?: boolean;
}

// Helper function to convert User to TeamMember
const convertUserToTeamMember = (
  user: User,
  role: "chef_equipe" | "membre_equipe",
): TeamMember => ({
  id: user.id,
  name: user.name,
  role: role,
  email: user.email,
});

export default function TaskAssignmentDialog({
  currentAssignedTo,
  availableMembers,
  onAssignmentChange,
  onTeamUpdate,
  taskName,
  canManage = false,
}: TaskAssignmentDialogProps) {
  const { isAdmin } = useAuth();
  const canAddMembers = isAdmin();
  const [open, setOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string | undefined>(
    currentAssignedTo,
  );
  const [showAddMember, setShowAddMember] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [tempTeam, setTempTeam] = useState<TeamMember[]>(availableMembers);

  // Update tempTeam when availableMembers changes
  useEffect(() => {
    setTempTeam(availableMembers);
  }, [availableMembers]);

  // Fetch users when dialog opens and add member section is shown (admin only)
  useEffect(() => {
    if (!canAddMembers) return;
    if (open && showAddMember && availableUsers.length === 0) {
      const fetchUsers = async () => {
        setIsLoadingUsers(true);
        try {
          const users = await authService.getAllUsers();
          setAvailableUsers(users);
        } catch (error) {
          console.error("Error fetching users:", error);
        } finally {
          setIsLoadingUsers(false);
        }
      };
      fetchUsers();
    }
  }, [open, showAddMember, availableUsers.length, canAddMembers]);

  // Filter to only show actual team members of this specific DAO
  const actualTeamMembers = tempTeam.filter(isValidTaskAssignee);

  // Get users that can be added to the team (not already in the team)
  const usersToAdd = availableUsers.filter(
    (user) => !tempTeam.some((member) => member.id === user.id),
  );

  const addMemberToTeam = (
    userId: string,
    role: "chef_equipe" | "membre_equipe",
  ) => {
    const user = availableUsers.find((u) => u.id === userId);
    if (user) {
      const newMember = convertUserToTeamMember(user, role);
      const updatedTeam = [...tempTeam, newMember];
      setTempTeam(updatedTeam);

      // If this is the only member being added and no one is selected, auto-select them
      if (!selectedMember && actualTeamMembers.length === 0) {
        setSelectedMember(userId);
      }
    }
  };

  const removeMemberFromTeam = (memberId: string) => {
    const updatedTeam = tempTeam.filter((member) => member.id !== memberId);
    setTempTeam(updatedTeam);

    // If we're removing the selected member, clear selection
    if (selectedMember === memberId) {
      setSelectedMember(undefined);
    }
  };

  // Debug logging (can be removed in production)
  if (process.env.NODE_ENV === "development") {
    console.log("🔍 TaskAssignmentDialog Debug:", {
      taskName,
      availableMembers: availableMembers.map((m) => ({
        name: m.name,
        role: m.role,
        email: m.email,
      })),
      actualTeamMembers: actualTeamMembers.map((m) => ({
        name: m.name,
        role: m.role,
        email: m.email,
      })),
      tempTeam: tempTeam.map((m) => ({
        name: m.name,
        role: m.role,
        email: m.email,
      })),
      usersToAdd: usersToAdd.map((u) => ({ name: u.name, email: u.email })),
    });
  }

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Update team if changes were made
    if (onTeamUpdate && tempTeam.length !== availableMembers.length) {
      onTeamUpdate(tempTeam);
    }

    onAssignmentChange(selectedMember);
    setOpen(false);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedMember(currentAssignedTo);
    setTempTeam(availableMembers); // Reset team changes
    setShowAddMember(false);
    setOpen(false);
  };

  const handleRemoveAssignment = () => {
    setSelectedMember(undefined);
  };

  const currentMember = actualTeamMembers.find(
    (m) => m.id === currentAssignedTo,
  );

  // Read-only view if user cannot manage assignments
  if (!canManage) {
    return currentMember ? (
      <span className="inline-flex items-center rounded-md border border-input bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-800">
        {currentMember.name}
      </span>
    ) : (
      <span className="text-xs text-muted-foreground">Non assigné</span>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {currentMember ? (
          <button className="inline-flex items-center rounded-md border border-input bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-800 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            {currentMember.name}
          </button>
        ) : (
          <Button variant="outline" size="sm" className="h-6 text-xs">
            <Plus className="h-3 w-3 mr-1" />
            Assigner
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Assigner la tâche
          </DialogTitle>
          <DialogDescription>
            Assignez un membre d'équipe à la tâche : "{taskName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Membre assigné</Label>
            {selectedMember ? (
              <div className="flex items-center justify-between p-2 border rounded">
                <div>
                  <span className="font-medium">
                    {
                      actualTeamMembers.find((m) => m.id === selectedMember)
                        ?.name
                    }
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {actualTeamMembers.find((m) => m.id === selectedMember)
                      ?.role === "chef_equipe"
                      ? "Chef d'équipe"
                      : "Membre d'équipe"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAssignment}
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucun membre assigné
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Choisir un membre</Label>
              {actualTeamMembers.length === 0 && (
                <Badge variant="outline" className="text-xs text-orange-600">
                  Aucun membre d'équipe
                </Badge>
              )}
            </div>
            <Select
              value={selectedMember || "unassigned"}
              onValueChange={(value) =>
                setSelectedMember(value === "unassigned" ? undefined : value)
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    actualTeamMembers.length === 0
                      ? "Ajoutez d'abord un membre à l'équipe..."
                      : "Sélectionner un membre..."
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Non assigné</SelectItem>
                {actualTeamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    <div className="flex items-center gap-2">
                      <span>{member.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {member.role === "chef_equipe" ? "Chef" : "Membre"}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Add Team Member Section (admin only) */}
          {canAddMembers && (
            <div className="border-t pt-4">
              <Collapsible open={showAddMember} onOpenChange={setShowAddMember}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <UserPlus className="h-4 w-4 mr-2" />
                    {showAddMember ? "Masquer" : "Ajouter un membre à l'équipe"}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 mt-3">
                  {isLoadingUsers ? (
                    <div className="text-center py-2 text-sm text-muted-foreground">
                      Chargement des utilisateurs...
                    </div>
                  ) : usersToAdd.length === 0 ? (
                    <div className="text-center py-2 text-sm text-muted-foreground">
                      Tous les utilisateurs sont déjà dans l'équipe
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Utilisateurs disponibles
                      </Label>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {usersToAdd.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-2 rounded border"
                          >
                            <div>
                              <div className="font-medium text-sm">
                                {user.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {user.email}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  addMemberToTeam(user.id, "membre_equipe")
                                }
                                className="h-6 text-xs"
                              >
                                + Membre
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  addMemberToTeam(user.id, "chef_equipe")
                                }
                                className="h-6 text-xs"
                              >
                                + Chef
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Show added members */}
          {tempTeam.length > availableMembers.length && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-green-600">
                Nouveaux membres ajoutés
              </Label>
              <div className="space-y-1">
                {tempTeam
                  .filter(
                    (member) =>
                      !availableMembers.some((m) => m.id === member.id),
                  )
                  .map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2 rounded border border-green-200 bg-green-50"
                    >
                      <div>
                        <span className="font-medium text-sm">
                          {member.name}
                        </span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {member.role === "chef_equipe" ? "Chef" : "Membre"}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMemberFromTeam(member.id)}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Annuler
          </Button>
          <Button onClick={handleSave}>Sauvegarder</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
