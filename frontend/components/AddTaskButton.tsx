import { useState } from "react";
import { Button } from "@/components/ui/button";
import TaskEditDialog from "./TaskEditDialog";
import { useAuth } from "@/contexts/AuthContext";
import type { DaoTask } from "@shared/dao";

interface AddTaskButtonProps {
  onTaskAdd: (
    newTaskData: Omit<DaoTask, "id" | "lastUpdatedAt" | "lastUpdatedBy">,
  ) => Promise<void> | void;
  canManage?: boolean;
}

export default function AddTaskButton({ onTaskAdd }: AddTaskButtonProps) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  // Only main admin can add tasks
  if (!isAdmin()) return null;

  const handleSave = (updates: Partial<DaoTask>) => {
    if (!updates.name) return;
    const payload: Omit<DaoTask, "id" | "lastUpdatedAt" | "lastUpdatedBy"> = {
      name: updates.name.trim(),
      isApplicable: updates.isApplicable ?? true,
      progress: 0,
      comment: "",
      assignedTo: undefined,
    };
    onTaskAdd(payload);
    setOpen(false);
  };

  return (
    <div className="pt-2 flex justify-center">
      <Button onClick={() => setOpen(true)}>Ajouter une tâche</Button>
      <TaskEditDialog open={open} onOpenChange={setOpen} onSave={handleSave} />
    </div>
  );
}
