import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DaoTask, TeamMember } from "@shared/dao";

interface TaskEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: DaoTask;
  onSave: (updates: Partial<DaoTask>) => void;
  availableMembers?: TeamMember[];
}

export default function TaskEditDialog({
  open,
  onOpenChange,
  task,
  onSave,
  availableMembers = [],
}: TaskEditDialogProps) {
  const [taskName, setTaskName] = useState("");
  const [isApplicable, setIsApplicable] = useState(true);
  const [assignedTo, setAssignedTo] = useState<string | undefined>(undefined);

  // Initialize form data when task changes or dialog opens
  useEffect(() => {
    if (task && open) {
      setTaskName(task.name);
      setIsApplicable(task.isApplicable);
      setAssignedTo(task.assignedTo);
    } else if (!task) {
      setTaskName("");
      setIsApplicable(true); // Default to applicable for new tasks
    }
  }, [task, open]);

  const handleSave = () => {
    if (!taskName.trim()) {
      return; // Don't save if name is empty
    }

    const updates: Partial<DaoTask> = {
      name: taskName.trim(),
      // N'inclure isApplicable que pour les nouvelles tâches
      ...(isEditing ? {} : { isApplicable }),
      ...(isEditing ? { assignedTo } : {}),
    };

    onSave(updates);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const isEditing = !!task;
  const title = isEditing ? "Modifier la tâche" : "Nouvelle tâche";
  const description = isEditing
    ? "Modifiez les détails de cette tâche."
    : "Ajoutez une nouvelle tâche à ce DAO.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Task Name */}
          <div className="space-y-2">
            <Label htmlFor="task-name">Nom de la tâche *</Label>
            <Input
              id="task-name"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="Entrez le nom de la tâche"
              className="w-full"
            />
          </div>

          {/* Is Applicable - Désactivé pour les tâches existantes pour éviter les conflicts */}
          <div className="flex items-center space-x-2">
            <Switch
              id="is-applicable"
              checked={isApplicable}
              onCheckedChange={setIsApplicable}
              disabled={isEditing} // Désactivé en mode édition
            />
            <Label
              htmlFor="is-applicable"
              className={isEditing ? "text-muted-foreground" : ""}
            >
              Cette tâche est applicable à ce DAO
              {isEditing && (
                <span className="block text-xs text-muted-foreground">
                  (Utilisez le switch sur la page principale pour modifier
                  l'applicabilité)
                </span>
              )}
            </Label>
          </div>
          {isEditing && (
            <div className="space-y-2">
              <Label htmlFor="assigned-to">Assigner à</Label>
              <Select
                value={assignedTo ?? "none"}
                onValueChange={(v) =>
                  setAssignedTo(v === "none" ? undefined : v)
                }
              >
                <SelectTrigger id="assigned-to">
                  <SelectValue placeholder="Non assigné" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non assigné</SelectItem>
                  {availableMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}{" "}
                      {m.role === "chef_equipe" ? "(Chef)" : "(Membre)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!taskName.trim()}>
            {isEditing ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
