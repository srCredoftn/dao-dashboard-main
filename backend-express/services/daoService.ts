import DaoModel from "../models/Dao";
import { connectToDatabase } from "../config/database";
import { daoStorage } from "../data/daoStorage";
import type { Dao } from "@shared/dao";

let useInMemory = false;
let connectionAttempted = false;

async function tryConnect(): Promise<boolean> {
  if (connectionAttempted) return !useInMemory;
  connectionAttempted = true;
  try {
    await connectToDatabase();
    useInMemory = false;
    return true;
  } catch (e) {
    console.warn("⚠️ MongoDB not available, falling back to in-memory storage");
    useInMemory = true;
    return false;
  }
}

export class DaoService {
  private static async ensureConnection() {
    await tryConnect();
  }

  // Get all DAOs
  static async getAllDaos(): Promise<Dao[]> {
    await this.ensureConnection();
    if (useInMemory) {
      return daoStorage
        .getAll()
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    const daos = await DaoModel.find().sort({ updatedAt: -1 });
    return daos.map((dao) => dao.toObject());
  }

  // Get DAO by ID
  static async getDaoById(id: string): Promise<Dao | null> {
    await this.ensureConnection();
    console.log(`🔎 DaoService: Looking for DAO with ID=${id}`);
    if (useInMemory) {
      const result = daoStorage.findById(id) || null;
      if (result) {
        console.log(`✅ DaoService: Found DAO ${id} -> ${result.numeroListe}`);
      } else {
        console.log(`❌ DaoService: DAO ${id} not found in storage`);
      }
      return result;
    }
    const dao = await DaoModel.findOne({ id });
    return dao ? dao.toObject() : null;
  }

  // Generate next DAO number
  static async generateNextDaoNumber(): Promise<string> {
    await this.ensureConnection();
    const year = new Date().getFullYear();
    if (useInMemory) {
      const existing = daoStorage
        .getAll()
        .filter((d) => d.numeroListe.startsWith(`DAO-${year}-`));
      if (existing.length === 0) return `DAO-${year}-001`;
      const nums = existing
        .map((d) => d.numeroListe.match(/DAO-\d{4}-(\d{3})/)?.[1])
        .map((n) => (n ? parseInt(n, 10) : 0))
        .filter((n) => !isNaN(n));
      const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
      return `DAO-${year}-${next.toString().padStart(3, "0")}`;
    }
    const existingDaos = await DaoModel.find({
      numeroListe: { $regex: `^DAO-${year}-` },
    }).sort({ numeroListe: -1 });
    if (existingDaos.length === 0) return `DAO-${year}-001`;
    const numbers = existingDaos
      .map((dao) => {
        const match = dao.numeroListe.match(/DAO-\d{4}-(\d{3})/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((num) => !isNaN(num));
    const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    return `DAO-${year}-${nextNumber.toString().padStart(3, "0")}`;
  }

  // Create new DAO
  static async createDao(
    daoData: Omit<Dao, "id" | "createdAt" | "updatedAt">,
  ): Promise<Dao> {
    await this.ensureConnection();
    const id = Date.now().toString();
    const now = new Date().toISOString();
    let numeroListe = daoData.numeroListe;
    if (!numeroListe || numeroListe.includes("001")) {
      numeroListe = await this.generateNextDaoNumber();
    }

    if (useInMemory) {
      const newDao: Dao = {
        ...daoData,
        numeroListe,
        id,
        createdAt: now,
        updatedAt: now,
      } as Dao;
      daoStorage.add(newDao);
      return newDao;
    }

    const dao = new DaoModel({
      ...daoData,
      numeroListe,
      id,
      createdAt: now,
      updatedAt: now,
    });
    const savedDao = await dao.save();
    return savedDao.toObject();
  }

  // Update DAO
  static async updateDao(
    id: string,
    updates: Partial<Dao>,
  ): Promise<Dao | null> {
    await this.ensureConnection();
    if (useInMemory) {
      const index = daoStorage.findIndexById(id);
      if (index === -1) return null;
      const existing = daoStorage.findById(id)!;
      const updated: Dao = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      } as Dao;
      daoStorage.updateAtIndex(index, updated);
      return updated;
    }
    const updatedDao = await DaoModel.findOneAndUpdate(
      { id },
      { ...updates, updatedAt: new Date().toISOString() },
      { new: true },
    );
    return updatedDao ? updatedDao.toObject() : null;
  }

  // Delete DAO
  static async deleteDao(id: string): Promise<boolean> {
    await this.ensureConnection();
    if (useInMemory) {
      return daoStorage.deleteById(id);
    }
    const result = await DaoModel.deleteOne({ id });
    return result.deletedCount > 0;
  }

  // Initialize with sample data if empty
  static async initializeSampleData(sampleDaos: Dao[]): Promise<void> {
    await this.ensureConnection();
    if (useInMemory) {
      // already seeded via daoStorage
      return;
    }
    const count = await DaoModel.countDocuments();
    if (count === 0) {
      console.log("🌱 Initializing database with sample data...");
      await DaoModel.insertMany(sampleDaos);
      console.log("✅ Sample data initialized");
    }
  }
}
