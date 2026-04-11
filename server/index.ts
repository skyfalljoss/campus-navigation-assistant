import "dotenv/config";

import { fileURLToPath } from "node:url";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { clerkMiddleware, getAuth } from "@clerk/express";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";

import { prisma } from "./prisma";
import { fetchShuttleSnapshot } from "./passio";
import { getWalkingRoute, NavigationError, readRouteRequest } from "./navigation";
import { isScheduleDay, isScheduleRangeValid, parseScheduleTimeInput } from "../src/lib/schedule";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const maxRecentLocations = 8;
const isProduction = process.env.NODE_ENV === "production";
const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY ?? process.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.resolve(serverDirectory, "../dist");
const clientIndexPath = path.join(distDirectory, "index.html");

function isAllowedDevelopmentOrigin(origin: string) {
  try {
    const parsedOrigin = new URL(origin);
    const hostname = parsedOrigin.hostname;

    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".local") ||
      /^192\.168\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    );
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || (!isProduction && isAllowedDevelopmentOrigin(origin))) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })
);
app.use(express.json());
app.use(
  clerkMiddleware({
    publishableKey: clerkPublishableKey,
    secretKey: clerkSecretKey,
  })
);

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

function asyncHandler(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

function requireUserId(req: Request, res: Response) {
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return null;
  }

  return userId;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function readScheduleEntry(value: unknown) {
  const entry = typeof value === "object" && value !== null ? value : {};
  const course = readString(Reflect.get(entry, "course"));
  const room = readString(Reflect.get(entry, "room"));
  const buildingId = readString(Reflect.get(entry, "buildingId"));
  const dayOfWeek = readString(Reflect.get(entry, "dayOfWeek"));
  const startTime = parseScheduleTimeInput(readString(Reflect.get(entry, "startTime"))) ?? "";
  const endTime = parseScheduleTimeInput(readString(Reflect.get(entry, "endTime"))) ?? "";

  return {
    course,
    room,
    buildingId,
    dayOfWeek,
    startTime,
    endTime,
    isValid: Boolean(course && room && buildingId && isScheduleDay(dayOfWeek) && isScheduleRangeValid(startTime, endTime)),
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post(
  "/api/navigation/route",
  asyncHandler(async (req, res) => {
    try {
      const { start, destinationBuildingId, roomId } = readRouteRequest(req.body);
      const route = await getWalkingRoute(start, destinationBuildingId, roomId);
      res.json(route);
    } catch (error) {
      if (error instanceof NavigationError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      throw error;
    }
  })
);

app.get(
  "/api/shuttle/overview",
  asyncHandler(async (_req, res) => {
    const snapshot = await fetchShuttleSnapshot();
    res.json(snapshot);
  })
);

app.get(
  "/api/shuttle/routes",
  asyncHandler(async (_req, res) => {
    const snapshot = await fetchShuttleSnapshot();
    res.json({
      systemId: snapshot.systemId,
      fetchedAt: snapshot.fetchedAt,
      reportedTime: snapshot.reportedTime,
      routes: snapshot.routes,
    });
  })
);

app.get(
  "/api/shuttle/vehicles",
  asyncHandler(async (_req, res) => {
    const snapshot = await fetchShuttleSnapshot();
    res.json({
      systemId: snapshot.systemId,
      fetchedAt: snapshot.fetchedAt,
      reportedTime: snapshot.reportedTime,
      vehicles: snapshot.vehicles,
    });
  })
);

app.get(
  "/api/shuttle/alerts",
  asyncHandler(async (_req, res) => {
    const snapshot = await fetchShuttleSnapshot();
    res.json({
      systemId: snapshot.systemId,
      fetchedAt: snapshot.fetchedAt,
      reportedTime: snapshot.reportedTime,
      alerts: snapshot.alerts,
    });
  })
);

app.get(
  "/api/saved-locations",
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) {
      return;
    }

    const locations = await prisma.savedLocation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ locations });
  })
);

app.post(
  "/api/saved-locations",
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) {
      return;
    }

    const buildingId = readString(req.body?.buildingId);
    if (!buildingId) {
      res.status(400).json({ error: "buildingId is required." });
      return;
    }

    const location = await prisma.savedLocation.upsert({
      where: {
        userId_buildingId: {
          userId,
          buildingId,
        },
      },
      update: {
        updatedAt: new Date(),
      },
      create: {
        userId,
        buildingId,
        updatedAt: new Date(),
      },
    });

    res.status(201).json({ location });
  })
);

app.delete(
  "/api/saved-locations/:buildingId",
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) {
      return;
    }

    const buildingId = readString(req.params.buildingId);
    if (!buildingId) {
      res.status(400).json({ error: "buildingId is required." });
      return;
    }

    await prisma.savedLocation.deleteMany({
      where: {
        userId,
        buildingId,
      },
    });

    res.status(204).end();
  })
);

app.get(
  "/api/recent-locations",
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) {
      return;
    }

    const locations = await prisma.recentSearch.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: maxRecentLocations,
    });

    res.json({ locations });
  })
);

app.post(
  "/api/recent-locations",
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) {
      return;
    }

    const buildingId = readString(req.body?.buildingId);
    const roomId = readString(req.body?.roomId) || null;
    const searchQuery = readString(req.body?.searchQuery) || buildingId;

    if (!buildingId) {
      res.status(400).json({ error: "buildingId is required." });
      return;
    }

    const fingerprint = roomId ? `${buildingId}:${roomId}` : buildingId;
    const location = await prisma.recentSearch.upsert({
      where: {
        userId_fingerprint: {
          userId,
          fingerprint,
        },
      },
      update: {
        roomId,
        query: searchQuery,
        buildingId,
        updatedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        userId,
        query: searchQuery,
        fingerprint,
        buildingId,
        roomId,
        updatedAt: new Date(),
      },
    });

    const staleLocations = await prisma.recentSearch.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      skip: maxRecentLocations,
      select: { id: true },
    });

    if (staleLocations.length > 0) {
      await prisma.recentSearch.deleteMany({
        where: {
          id: { in: staleLocations.map((entry) => entry.id) },
        },
      });
    }

    res.status(201).json({ location });
  })
);

app.get(
  "/api/schedule",
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) {
      return;
    }

    const entries = await prisma.scheduleEntry.findMany({
      where: { userId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }, { endTime: "asc" }],
    });

    res.json({ entries });
  })
);

app.post(
  "/api/schedule",
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) {
      return;
    }

    const { course, room, buildingId, dayOfWeek, startTime, endTime, isValid } = readScheduleEntry(req.body);

    if (!isValid) {
      res.status(400).json({ error: "course, room, building, day, start time, and end time are required." });
      return;
    }

    const entry = await prisma.scheduleEntry.create({
      data: {
        userId,
        course,
        room,
        buildingId,
        dayOfWeek,
        startTime,
        endTime,
      },
    });

    res.status(201).json({ entry });
  })
);

app.post(
  "/api/schedule/bulk",
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) {
      return;
    }

    const bodyEntries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    const entries = bodyEntries.map(readScheduleEntry);

    if (entries.length === 0) {
      res.status(400).json({ error: "At least one schedule entry is required." });
      return;
    }

    if (entries.some((entry) => !entry.isValid)) {
      res.status(400).json({ error: "Each imported line must include course, room, building, day, start time, and end time." });
      return;
    }

    const importedEntries = await prisma.$transaction(
      entries.map((entry) =>
        prisma.scheduleEntry.create({
          data: {
            userId,
            course: entry.course,
            room: entry.room,
            buildingId: entry.buildingId,
            dayOfWeek: entry.dayOfWeek,
            startTime: entry.startTime,
            endTime: entry.endTime,
          },
        })
      )
    );

    res.status(201).json({ entries: importedEntries });
  })
);

app.patch(
  "/api/schedule/:entryId",
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) {
      return;
    }

    const entryId = readString(req.params.entryId);
    const { course, room, buildingId, dayOfWeek, startTime, endTime, isValid } = readScheduleEntry(req.body);

    if (!entryId || !isValid) {
      res.status(400).json({ error: "course, room, building, day, start time, and end time are required." });
      return;
    }

    const existingEntry = await prisma.scheduleEntry.findFirst({
      where: {
        id: entryId,
        userId,
      },
    });

    if (!existingEntry) {
      res.status(404).json({ error: "Schedule entry not found." });
      return;
    }

    const entry = await prisma.scheduleEntry.update({
      where: { id: entryId },
      data: {
        course,
        room,
        buildingId,
        dayOfWeek,
        startTime,
        endTime,
      },
    });

    res.json({ entry });
  })
);

app.delete(
  "/api/schedule/:entryId",
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) {
      return;
    }

    const entryId = readString(req.params.entryId);
    if (!entryId) {
      res.status(400).json({ error: "entryId is required." });
      return;
    }

    const deletedEntries = await prisma.scheduleEntry.deleteMany({
      where: {
        id: entryId,
        userId,
      },
    });

    if (deletedEntries.count === 0) {
      res.status(404).json({ error: "Schedule entry not found." });
      return;
    }

    res.status(204).end();
  })
);

if (isProduction) {
  app.use(express.static(distDirectory));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }

    res.sendFile(clientIndexPath, (error) => {
      if (error) {
        next(error);
      }
    });
  });
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "Something went wrong." });
});

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
