import express from "express";
import { z } from "zod";
import {
  authenticate,
  requireAdmin,
  auditLog,
  sensitiveOperationLimit,
  requireDaoLeaderOrAdmin,
} from "../middleware/auth";
import { devLog } from "../utils/devLog";
import { DEFAULT_TASKS } from "@shared/dao";
import type { Dao } from "@shared/dao";
import { DaoService } from "../services/daoService";

const router = express.Router();

// Validation schemas
const teamMemberSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(100).trim(),
  role: z.enum(["chef_equipe", "membre_equipe"]),
  email: z.string().email().optional(),
});

const taskSchema = z.object({
  id: z.number().int().min(1),
  name: z.string().min(1).max(200).trim(),
  progress: z.number().min(0).max(100).nullable(),
  comment: z.string().max(1000).optional(),
  isApplicable: z.boolean(),
  assignedTo: z.string().max(50).optional(),
  lastUpdatedBy: z.string().max(50).optional(),
  lastUpdatedAt: z.string().optional(),
});

const createDaoSchema = z.object({
  numeroListe: z.string().min(1).max(50).trim(),
  objetDossier: z.string().min(1).max(500).trim(),
  reference: z.string().min(1).max(200).trim(),
  autoriteContractante: z.string().min(1).max(200).trim(),
  dateDepot: z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), "Invalid date format"),
  equipe: z.array(teamMemberSchema).min(1).max(20),
  tasks: z.array(taskSchema).max(50).optional(),
});

const updateDaoSchema = createDaoSchema.partial();

const taskUpdateSchema = z.object({
  progress: z.number().min(0).max(100).optional(),
  comment: z.string().max(1000).optional(),
  isApplicable: z.boolean().optional(),
  assignedTo: z.string().max(50).optional(),
});

// Helper to sanitize string
function sanitizeString(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

// GET /api/dao - Get all DAOs (authenticated users only)
router.get("/", authenticate, auditLog("VIEW_ALL_DAOS"), async (req, res) => {
  try {
    const daos = await DaoService.getAllDaos();
    devLog.info(
      `Serving ${daos.length} DAOs to ${req.user?.email} (${req.user?.role})`,
    );
    res.json(daos);
  } catch (error) {
    devLog.error("Error in GET /api/dao:", error);
    return void res.status(500).json({
      error: "Failed to fetch DAOs",
      code: "FETCH_ERROR",
    });
  }
});

// GET /api/dao/next-number - Get next DAO number (authenticated users only)
router.get("/next-number", authenticate, async (req, res) => {
  try {
    const next = await DaoService.generateNextDaoNumber();
    console.log(`🔢 Generated next DAO number: ${next} for ${req.user?.email}`);
    res.json({ nextNumber: next });
  } catch (error) {
    console.error("Error in GET /api/dao/next-number:", error);
    res.status(500).json({
      error: "Failed to generate next DAO number",
      code: "GENERATION_ERROR",
    });
  }
});

// GET /api/dao/:id - Get DAO by ID (authenticated users only)
router.get("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(
      `🎯 SERVER: GET /api/dao/${id} requested by ${req.user?.email}`,
    );

    if (!id || id.length > 100) {
      console.log(`❌ SERVER: Invalid DAO ID: ${id}`);
      return void res.status(400).json({
        error: "Invalid DAO ID",
        code: "INVALID_ID",
      });
    }

    const dao = await DaoService.getDaoById(id);
    if (!dao) {
      console.log(`❌ SERVER: DAO not found for ID: ${id}`);
      return void res.status(404).json({
        error: "DAO not found",
        code: "DAO_NOT_FOUND",
      });
    }

    console.log(
      `✅ SERVER: Serving DAO ${id} (${dao.numeroListe}) to ${req.user?.email}`,
    );
    return void res.json(dao);
  } catch (error) {
    console.error("Error in GET /api/dao/:id:", error);
    return void res.status(500).json({
      error: "Failed to fetch DAO",
      code: "FETCH_ERROR",
    });
  }
});

// POST /api/dao - Create new DAO (admin only)
router.post(
  "/",
  authenticate,
  requireAdmin,
  auditLog("CREATE_DAO"),
  sensitiveOperationLimit(),
  async (req, res) => {
    try {
      const validatedData = createDaoSchema.parse(req.body);

      // Sanitize string fields
      const sanitizedData = {
        ...validatedData,
        numeroListe: sanitizeString(validatedData.numeroListe),
        objetDossier: sanitizeString(validatedData.objetDossier),
        reference: sanitizeString(validatedData.reference),
        autoriteContractante: sanitizeString(
          validatedData.autoriteContractante,
        ),
        equipe: validatedData.equipe.map((member) => ({
          ...member,
          name: sanitizeString(member.name),
        })),
      };

      const now = new Date().toISOString();
      const tasks = (
        validatedData.tasks && validatedData.tasks.length
          ? validatedData.tasks
          : DEFAULT_TASKS.map((task) => ({
              ...task,
              progress: null,
              comment: "",
            }))
      ).map((t: any, idx: number) => ({
        id: typeof t.id === "number" ? t.id : idx + 1,
        name: sanitizeString(t.name),
        progress: t.isApplicable ? (t.progress ?? null) : null,
        comment: t.comment ? sanitizeString(t.comment) : undefined,
        isApplicable: t.isApplicable,
        assignedTo: typeof t.assignedTo === "string" ? t.assignedTo : undefined,
        lastUpdatedBy: req.user!.id,
        lastUpdatedAt: now,
      }));

      const newDao = await DaoService.createDao({
        numeroListe: sanitizedData.numeroListe,
        objetDossier: sanitizedData.objetDossier,
        reference: sanitizedData.reference,
        autoriteContractante: sanitizedData.autoriteContractante,
        dateDepot: sanitizedData.dateDepot,
        equipe: sanitizedData.equipe,
        tasks,
      });

      console.log(
        `✨ Created new DAO: ${newDao.numeroListe} by ${req.user?.email}`,
      );

      // Notify platform and email all users
      try {
        const { NotificationService } = await import(
          "../services/notificationService"
        );
        const { AuthService } = await import("../services/authService");
        const { EmailService } = await import("../services/emailService");
        NotificationService.broadcast(
          "dao_created",
          "Nouveau DAO créé",
          `${newDao.numeroListe} – ${newDao.objetDossier}`,
          { daoId: newDao.id },
        );
        const users = await AuthService.getAllUsers();
        await EmailService.sendBulkNotification(
          users.map((u) => u.email),
          "Nouveau DAO",
          `Un nouveau DAO a été créé: ${newDao.numeroListe} – ${newDao.objetDossier}.`,
        );
      } catch (_) {}

      res.status(201).json(newDao);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return void res.status(400).json({
          error: "Validation error",
          details: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
          code: "VALIDATION_ERROR",
        });
      }
      if (error?.code === 11000) {
        return void res.status(400).json({
          error: "DAO number already exists",
          code: "DUPLICATE_NUMBER",
        });
      }

      console.error("Error in POST /api/dao:", error);
      res.status(500).json({
        error: "Failed to create DAO",
        code: "CREATE_ERROR",
      });
    }
  },
);

// PUT /api/dao/:id - Update DAO (users and admins)
router.put(
  "/:id",
  authenticate,
  requireDaoLeaderOrAdmin("id"),
  auditLog("UPDATE_DAO"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!id || id.length > 100) {
        return void res.status(400).json({
          error: "Invalid DAO ID",
          code: "INVALID_ID",
        });
      }

      const validatedData = updateDaoSchema.parse(req.body);

      // Sanitize updates
      const updates: Partial<Dao> = {};
      if (validatedData.numeroListe)
        updates.numeroListe = sanitizeString(validatedData.numeroListe);
      if (validatedData.objetDossier)
        updates.objetDossier = sanitizeString(validatedData.objetDossier);
      if (validatedData.reference)
        updates.reference = sanitizeString(validatedData.reference);
      if (validatedData.autoriteContractante)
        updates.autoriteContractante = sanitizeString(
          validatedData.autoriteContractante,
        );
      if (validatedData.equipe)
        updates.equipe = validatedData.equipe.map((m) => ({
          ...m,
          name: sanitizeString(m.name),
        }));
      if (validatedData.tasks) updates.tasks = validatedData.tasks as any;

      const before = await DaoService.getDaoById(id);
      const updated = await DaoService.updateDao(id, updates);
      if (!updated) {
        return void res
          .status(404)
          .json({ error: "DAO not found", code: "DAO_NOT_FOUND" });
      }

      // Notify on team role/member changes
      try {
        const { NotificationService } = await import(
          "../services/notificationService"
        );
        const { EmailService } = await import("../services/emailService");
        let hasTaskChanges = false;

        if (before && validatedData.equipe) {
          const beforeMap = new Map(before.equipe.map((m) => [m.id, m]));
          const afterMap = new Map(updated.equipe.map((m) => [m.id, m]));

          const changed: string[] = [];
          for (const [idKey, after] of afterMap) {
            const prev = beforeMap.get(idKey);
            if (!prev) changed.push(`${after.name} ajouté`);
            else if (prev.role !== after.role)
              changed.push(`${after.name}: ${prev.role} → ${after.role}`);
          }
          for (const [idKey, prev] of beforeMap) {
            if (!afterMap.has(idKey)) changed.push(`${prev.name} retiré`);
          }

          if (changed.length > 0) {
            NotificationService.broadcast(
              "role_update",
              "Modification de l'équipe",
              changed.join(", "),
              { daoId: updated.id, changes: changed },
            );

            // Email affected members when emails exist
            const emails = updated.equipe
              .concat(before?.equipe || [])
              .filter((m) => m.email)
              .map((m) => m.email!)
              .slice(0, 50);
            if (emails.length) {
              await EmailService.sendBulkNotification(
                emails,
                "Mise à jour de l'équipe du DAO",
                `Modifications: ${changed.join(", ")}`,
              );
            }
          }
        }

        // If tasks changed via this endpoint, produce precise per-task notifications + emails
        if (before && Array.isArray(validatedData.tasks)) {
          const byIdBefore = new Map(before.tasks.map((t) => [t.id, t]));
          for (const t of updated.tasks) {
            const prev = byIdBefore.get(t.id);
            if (!prev) continue;
            const diffs: string[] = [];
            if (prev.isApplicable !== t.isApplicable) {
              diffs.push(
                `applicabilité ${prev.isApplicable ? "Oui" : "Non"} → ${t.isApplicable ? "Oui" : "Non"}`,
              );
            }
            const p1 = prev.progress ?? 0;
            const p2 = t.progress ?? 0;
            if (p1 !== p2 && t.isApplicable) {
              diffs.push(`progression ${p1}% → ${p2}%`);
            }
            if (prev.comment !== t.comment) diffs.push("commentaire modifié");
            if (prev.assignedTo !== t.assignedTo) {
              diffs.push(
                prev.assignedTo
                  ? `réassignée (${prev.assignedTo} → ${t.assignedTo ?? "aucun"})`
                  : `assignée à ${t.assignedTo ?? "aucun"}`,
              );
            }
            if (diffs.length > 0) {
              hasTaskChanges = true;
              NotificationService.broadcast(
                "task_updated",
                "Tâche mise à jour",
                `DAO ${updated.numeroListe} – Tâche #${t.id} (${t.name}): ${diffs.join(", ")}`,
                { daoId: id, taskId: t.id, changes: diffs },
              );
              try {
                const { AuthService } = await import("../services/authService");
                const users = await AuthService.getAllUsers();
                await EmailService.sendBulkNotification(
                  users.map((u) => u.email),
                  "Tâche mise à jour",
                  `DAO ${updated.numeroListe} – Tâche #${t.id} (${t.name}) mise à jour: ${diffs.join(", ")}.`,
                );
              } catch (_) {}
            }
          }
        }

        // Mark on res.locals to inform later step whether to broadcast generic update
        (res as any).hasTaskChanges =
          (res as any).hasTaskChanges || hasTaskChanges;
      } catch (_) {}

      // Always broadcast a general DAO update and email all users
      try {
        const { NotificationService } = await import(
          "../services/notificationService"
        );
        const changedFields: string[] = [];
        if (before && updated) {
          if (before.numeroListe !== updated.numeroListe)
            changedFields.push("numéro de liste");
          if (before.objetDossier !== updated.objetDossier)
            changedFields.push("objet du dossier");
          if (before.reference !== updated.reference)
            changedFields.push("référence");
          if (before.autoriteContractante !== updated.autoriteContractante)
            changedFields.push("autorité contractante");
          if (before.dateDepot !== updated.dateDepot)
            changedFields.push("date de dépôt");
        }
        const hasTaskChanges = (res as any).hasTaskChanges === true;
        if (changedFields.length > 0 || !hasTaskChanges) {
          NotificationService.broadcast(
            "dao_updated",
            "DAO mis à jour",
            changedFields.length
              ? `DAO ${updated.numeroListe} – Champs modifiés: ${changedFields.join(", ")}`
              : `DAO ${updated.numeroListe} modifié`,
            { daoId: updated.id, changedFields },
          );
          const { AuthService } = await import("../services/authService");
          const { EmailService } = await import("../services/emailService");
          const users = await AuthService.getAllUsers();
          await EmailService.sendBulkNotification(
            users.map((u) => u.email),
            "DAO mis à jour",
            changedFields.length
              ? `Le DAO ${updated.numeroListe} a été mis à jour. Champs modifiés: ${changedFields.join(", ")}.`
              : `Le DAO ${updated.numeroListe} a été modifié.`,
          );
        }
      } catch (_) {}

      console.log(`📝 Updated DAO: ${id} by ${req.user?.email}`);
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return void res.status(400).json({
          error: "Validation error",
          details: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
          code: "VALIDATION_ERROR",
        });
      }
      if (error?.code === 11000) {
        return void res.status(400).json({
          error: "DAO number already exists",
          code: "DUPLICATE_NUMBER",
        });
      }

      console.error("Error in PUT /api/dao/:id:", error);
      res.status(500).json({
        error: "Failed to update DAO",
        code: "UPDATE_ERROR",
      });
    }
  },
);

// DELETE /api/dao/:id - Delete DAO (admin only)
router.delete(
  "/:id",
  authenticate,
  auditLog("DELETE_DAO_ATTEMPT"),
  async (_req, res) => {
    return res.status(403).json({
      error: "DAO deletion is disabled",
      code: "DAO_DELETE_DISABLED",
    });
  },
);

// GET /api/dao/admin/verify-integrity - Force integrity check (admin only)
router.get(
  "/admin/verify-integrity",
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      console.log(`🔧 ADMIN: Integrity check requested by ${req.user?.email}`);

      // Force integrity verification
      const { daoStorage } = await import("../data/daoStorage");
      const isIntegrityOk = daoStorage.verifyIntegrity();

      const allDaos = await DaoService.getAllDaos();

      const report = {
        integrityCheck: isIntegrityOk ? "PASSED" : "FAILED",
        totalDaos: allDaos.length,
        daos: allDaos.map((dao) => ({
          id: dao.id,
          numeroListe: dao.numeroListe,
          objetDossier: dao.objetDossier.substring(0, 50) + "...",
        })),
        timestamp: new Date().toISOString(),
      };

      console.log(`✅ ADMIN: Integrity report generated`);
      res.json(report);
    } catch (error) {
      console.error("Error in GET /api/dao/admin/verify-integrity:", error);
      res.status(500).json({
        error: "Failed to verify integrity",
        code: "INTEGRITY_CHECK_ERROR",
      });
    }
  },
);

// PUT /api/dao/:id/tasks/reorder - Reorder tasks
router.put(
  "/:id/tasks/reorder",
  authenticate,
  requireDaoLeaderOrAdmin("id"),
  auditLog("REORDER_TASKS"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { taskIds } = req.body as { taskIds: number[] };

      if (!id || id.length > 100) {
        return void res.status(400).json({
          error: "Invalid DAO ID",
          code: "INVALID_DAO_ID",
        });
      }

      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return void res.status(400).json({
          error: "Invalid task IDs array",
          code: "INVALID_TASK_IDS",
        });
      }

      const dao = await DaoService.getDaoById(id);
      if (!dao) {
        return void res.status(404).json({
          error: "DAO not found",
          code: "DAO_NOT_FOUND",
        });
      }

      const existingTaskIds = dao.tasks.map((t) => t.id);
      const invalidIds = taskIds.filter(
        (tid) => !existingTaskIds.includes(tid),
      );
      if (invalidIds.length > 0) {
        return void res.status(400).json({
          error: "Some task IDs do not exist",
          code: "INVALID_TASK_IDS",
          invalidIds,
        });
      }

      if (
        taskIds.length !== dao.tasks.length ||
        !existingTaskIds.every((tid) => taskIds.includes(tid))
      ) {
        return void res.status(400).json({
          error: "Task IDs must include all existing tasks",
          code: "INCOMPLETE_TASK_LIST",
        });
      }

      const reorderedTasks = taskIds.map(
        (taskId) => dao.tasks.find((task) => task.id === taskId)!,
      );

      const updated = await DaoService.updateDao(id, {
        tasks: reorderedTasks,
      });

      // Notify and email all users
      try {
        const { NotificationService } = await import(
          "../services/notificationService"
        );
        const { AuthService } = await import("../services/authService");
        const { EmailService } = await import("../services/emailService");
        NotificationService.broadcast(
          "task_reordered",
          "Réorganisation des tâches",
          `Les tâches du DAO ${dao.numeroListe} ont été réordonnées`,
          { daoId: id },
        );
        const users = await AuthService.getAllUsers();
        await EmailService.sendBulkNotification(
          users.map((u) => u.email),
          "Réorganisation des tâches",
          `Les tâches du DAO ${id} ont été réordonnées`,
        );
      } catch (_) {}

      console.log(`🔄 Reordered tasks in DAO ${id} by ${req.user?.email}`);
      res.json(updated);
    } catch (error) {
      console.error("Error in PUT /api/dao/:id/tasks/reorder:", error);
      res.status(500).json({
        error: "Failed to reorder tasks",
        code: "REORDER_ERROR",
      });
    }
  },
);

// PUT /api/dao/:id/tasks/:taskId - Update specific task
router.put(
  "/:id/tasks/:taskId",
  authenticate,
  requireDaoLeaderOrAdmin("id"),
  auditLog("UPDATE_TASK"),
  async (req, res) => {
    try {
      const { id, taskId } = req.params;

      if (!id || id.length > 100) {
        return void res.status(400).json({
          error: "Invalid DAO ID",
          code: "INVALID_DAO_ID",
        });
      }

      const parsedTaskId = parseInt(taskId);
      if (isNaN(parsedTaskId) || parsedTaskId < 1) {
        return void res.status(400).json({
          error: "Invalid task ID",
          code: "INVALID_TASK_ID",
        });
      }

      const validatedData = taskUpdateSchema.parse(req.body);

      const dao = await DaoService.getDaoById(id);
      if (!dao) {
        return void res.status(404).json({
          error: "DAO not found",
          code: "DAO_NOT_FOUND",
        });
      }

      const task = dao.tasks.find((t) => t.id === parsedTaskId);
      if (!task) {
        return void res.status(404).json({
          error: "Task not found",
          code: "TASK_NOT_FOUND",
        });
      }

      const previous = { ...task };

      if (typeof validatedData.progress === "number") {
        task.progress = validatedData.progress;
      }
      if (typeof validatedData.comment === "string") {
        task.comment = sanitizeString(validatedData.comment);
      }
      if (typeof validatedData.isApplicable === "boolean") {
        task.isApplicable = validatedData.isApplicable;
      }
      if (typeof validatedData.assignedTo === "string") {
        task.assignedTo = sanitizeString(validatedData.assignedTo);
      }

      task.lastUpdatedBy = req.user!.id;
      task.lastUpdatedAt = new Date().toISOString();

      const updated = await DaoService.updateDao(id, { tasks: dao.tasks });

      // Notifications & emails
      try {
        const { NotificationService } = await import(
          "../services/notificationService"
        );
        const { EmailService } = await import("../services/emailService");

        // Build precise change list
        const changes: string[] = [];
        if ((previous.progress ?? 0) !== (task.progress ?? 0))
          changes.push(
            `progression ${previous.progress ?? 0}% → ${task.progress ?? 0}%`,
          );
        if (previous.comment !== task.comment)
          changes.push("commentaire modifié");
        if (previous.isApplicable !== task.isApplicable)
          changes.push(
            `applicabilité ${previous.isApplicable ? "oui" : "non"} → ${task.isApplicable ? "oui" : "non"}`,
          );
        if (previous.assignedTo !== task.assignedTo)
          changes.push(
            previous.assignedTo
              ? `réassignée (${previous.assignedTo} → ${task.assignedTo ?? "aucun"})`
              : `assignée à ${task.assignedTo ?? "aucun"}`,
          );

        if (previous.assignedTo !== task.assignedTo) {
          const isUnassign = !task.assignedTo;
          NotificationService.broadcast(
            isUnassign ? "task_unassigned" : "task_assigned",
            isUnassign ? "Tâche désassignée" : "Tâche assignée",
            `DAO ${dao.numeroListe} – Tâche #${task.id} (${task.name}): ${changes.join(", ")}`,
            { daoId: id, taskId: task.id, assignedTo: task.assignedTo },
          );

          // Email to new assignee (if we can find email via DAO team)
          const newAssignee = dao.equipe.find((m) => m.id === task.assignedTo);
          if (newAssignee?.email) {
            await EmailService.sendNotificationEmail(
              newAssignee.email,
              "Nouvelle tâche assignée",
              `La tâche "${task.name}" vous a été assignée sur le DAO ${dao.numeroListe}.`,
            );
          }
        } else {
          NotificationService.broadcast(
            "task_updated",
            "Tâche mise à jour",
            `DAO ${dao.numeroListe} – Tâche #${task.id} (${task.name}): ${changes.join(", ") || "modification"}`,
            { daoId: id, taskId: task.id, changes },
          );
        }

        // Email all users for any task update
        try {
          const { AuthService } = await import("../services/authService");
          const users = await AuthService.getAllUsers();
          await EmailService.sendBulkNotification(
            users.map((u) => u.email),
            "Mise à jour de tâche",
            `DAO ${dao.numeroListe} – Tâche #${task.id} (${task.name}) mise à jour: ${changes.join(", ") || "modification"}.`,
          );
        } catch (_) {}
      } catch (_) {}

      console.log(
        `📋 Updated task ${parsedTaskId} in DAO ${id} by ${req.user?.email}`,
      );
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return void res.status(400).json({
          error: "Validation error",
          details: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
          code: "VALIDATION_ERROR",
        });
      }

      console.error("Error in PUT /api/dao/:id/tasks/:taskId:", error);
      res.status(500).json({
        error: "Failed to update task",
        code: "TASK_UPDATE_ERROR",
      });
    }
  },
);

export default router;
