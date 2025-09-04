import { useState } from "react";
import { Edit3, Users, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { type TeamMember, type User } from "@shared/dao";
import { authService } from "@/services/authService";
import { useEffect } from "react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

// Helper to convert users to team members
const convertUserToTeamMember = (
  user: User,
  role: "chef_equipe" | "membre_equipe" = "membre_equipe",
): TeamMember => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role,
});

interface TeamEditDialogProps {
  currentTeam: TeamMember[];
  onTeamUpdate: (newTeam: TeamMember[]) => void;
  type: "chef" | "membres";
}

export default function TeamEditDialog({
  currentTeam,
  onTeamUpdate,
  type,
}: TeamEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [tempTeam, setTempTeam] = useState<TeamMember[]>(currentTeam);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Fetch users when dialog opens
  useEffect(() => {
    if (open) {
      const fetchUsers = async () => {
        setIsLoadingUsers(true);
        try {
          const users = await authService.getAllUsers();
          setAvailableUsers(users);
        } catch (error) {
          console.error("Failed to fetch users:", error);
        } finally {
          setIsLoadingUsers(false);
        }
      };
      fetchUsers();
    }
  }, [open]);

  // Convert users to available members format
  const availableMembers: TeamMember[] = availableUsers.map((user) =>
    convertUserToTeamMember(
      user,
      type === "chef" ? "chef_equipe" : "membre_equipe",
    ),
  );

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Merge the current team with the edited members
    let newTeam: TeamMember[];

    if (type === "chef") {
      // For chef editing: keep all existing membres, replace chef
      const existingMembers = currentTeam.filter(
        (m) => m.role === "membre_equipe",
      );
      const newChef = tempTeam.find((m) => m.role === "chef_equipe");
      newTeam = newChef ? [...existingMembers, newChef] : existingMembers;
    } else {
      // For membres editing: keep existing chef, replace membres
      const existingChef = currentTeam.find((m) => m.role === "chef_equipe");
      const newMembers = tempTeam.filter((m) => m.role === "membre_equipe");
      newTeam = existingChef ? [existingChef, ...newMembers] : newMembers;
    }

    onTeamUpdate(newTeam);
    setOpen(false);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTempTeam(currentTeam);
    setOpen(false);
  };

  const addExistingMember = (member: TeamMember) => {
    if (type === "chef") {
      // For chef, replace the current chef
      const newTeam = tempTeam.filter((m) => m.role !== "chef_equipe");
      setTempTeam([...newTeam, { ...member, role: "chef_equipe" }]);
    } else {
      // For membres, add if not already in team
      if (!tempTeam.find((m) => m.id === member.id)) {
        setTempTeam([...tempTeam, { ...member, role: "membre_equipe" }]);
      }
    }
  };

  const addNewMember = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (newMemberName.trim()) {
      const newMember: TeamMember = {
        id: Date.now().toString(),
        name: newMemberName.trim(),
        email: newMemberEmail.trim() || undefined,
        role: type === "chef" ? "chef_equipe" : "membre_equipe",
      };

      if (type === "chef") {
        const newTeam = tempTeam.filter((m) => m.role !== "chef_equipe");
        setTempTeam([...newTeam, newMember]);
      } else {
        setTempTeam([...tempTeam, newMember]);
      }

      setNewMemberName("");
      setNewMemberEmail("");
    }
  };

  const removeMember = (memberId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setTempTeam(tempTeam.filter((m) => m.id !== memberId));
  };

  const currentMembers =
    type === "chef"
      ? tempTeam.filter((m) => m.role === "chef_equipe")
      : tempTeam.filter((m) => m.role === "membre_equipe");

  const availableToAdd = availableMembers.filter((member) => {
    // Check if already in the current team (not just tempTeam)
    const isInCurrentTeam = currentTeam.find((m) => m.id === member.id);
    return !isInCurrentTeam;
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          <Edit3 className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Modifier{" "}
            {type === "chef" ? "le chef d'équipe" : "les membres d'équipe"}
          </DialogTitle>
          <DialogDescription>
            {type === "chef"
              ? "Sélectionnez ou ajoutez un chef d'équipe"
              : "Gérez les membres de l'équipe"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Members */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {type === "chef" ? "Chef actuel" : "Membres actuels"}
            </Label>
            {currentMembers.length > 0 ? (
              <div className="space-y-2">
                {currentMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 border rounded"
                  >
                    <div>
                      <span className="font-medium">{member.name}</span>
                      {member.email && (
                        <p className="text-xs text-muted-foreground">
                          {member.email}
                        </p>
                      )}
                    </div>
                    <ConfirmationDialog
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      }
                      title={`Retirer ${type === "chef" ? "le chef d'équipe" : "le membre"}`}
                      description={`Êtes-vous sûr de vouloir retirer ${member.name} de l'équipe ?`}
                      confirmText="Retirer"
                      onConfirm={() => removeMember(member.id)}
                      icon="warning"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {type === "chef"
                  ? "Aucun chef assigné"
                  : "Aucun membre assigné"}
              </p>
            )}
          </div>

          {/* Add from existing */}
          {availableToAdd.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Ajouter un membre existant
              </Label>
              <Select
                onValueChange={(value) => {
                  const member = availableMembers.find((m) => m.id === value);
                  if (member) addExistingMember(member);
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoadingUsers ? "Chargement..." : "Sélectionner..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableToAdd.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} {member.email && `(${member.email})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Section création de membre (cachée pour l’instant) */}
          {/*
<div className="space-y-2">
  <Label className="text-sm font-medium">
    {type === "chef"
      ? "Ou créer un nouveau chef"
      : "Ou ajouter un nouveau membre"}
  </Label>
</div>
*/}

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {type === "chef"
                ? "Ou créer un nouveau chef"
                : "Ou ajouter un nouveau membre"}
            </Label>
            <div className="space-y-2">
              <Input
                placeholder="Nom complet *"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
              />
              <Input
                placeholder="Email (optionnel)"
                type="email"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addNewMember}
                disabled={!newMemberName.trim()}
                className="w-full"
              >
                <Plus className="h-3 w-3 mr-2" />
                Ajouter
              </Button>
            </div>
          </div>
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
