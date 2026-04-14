import type { Page } from "@playwright/test";

export async function blockExternalMapTiles(page: Page) {
  await page.route(/https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/, async (route) => {
    await route.fulfill({
      status: 204,
      body: "",
    });
  });
}

export async function mockShuttleOverview(page: Page) {
  await page.route("**/api/shuttle/overview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        systemId: "2343",
        fetchedAt: "2026-04-13T14:30:00.000Z",
        reportedTime: "2026-04-13T14:29:00.000Z",
        routeCount: 2,
        activeVehicleCount: 3,
        alertCount: 1,
        routes: [
          {
            id: "orange",
            name: "Orange Line",
            shortName: "OR",
            color: "#006747",
            serviceTimeShort: "7 AM - 7 PM",
            activeVehicleCount: 2,
          },
          {
            id: "green",
            name: "Green Line",
            shortName: "GR",
            color: "#84d7af",
            serviceTimeShort: "7 AM - 7 PM",
            activeVehicleCount: 1,
          },
        ],
        vehicles: [
          {
            id: "bus-1",
            name: "Bus 1",
            routeId: "orange",
            routeName: "Orange Line",
            color: "#006747",
            speed: 8,
            latitude: 28.061,
            longitude: -82.413,
          },
          {
            id: "bus-2",
            name: "Bus 2",
            routeId: "orange",
            routeName: "Orange Line",
            color: "#006747",
            speed: 11,
            latitude: 28.062,
            longitude: -82.414,
          },
          {
            id: "bus-3",
            name: "Bus 3",
            routeId: "green",
            routeName: "Green Line",
            color: "#84d7af",
            speed: 10,
            latitude: 28.063,
            longitude: -82.415,
          },
        ],
        alerts: [
          {
            id: "alert-1",
            title: "Minor service delay on Orange Line",
            message: "Traffic near the student center may add a few minutes to arrivals.",
            from: null,
            to: null,
            updated: "2026-04-13T14:15:00.000Z",
          },
        ],
      }),
    });
  });
}
