import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bus, Clock3, MapPinned, Navigation, RefreshCw, Route as RouteIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

import { fetchShuttleOverview, type ShuttleOverviewRecord, type ShuttleRouteRecord, type ShuttleVehicleRecord } from "../lib/api";
import { CAMPUS_CENTER } from "../lib/navigation";
import { cn } from "../lib/utils";

function formatShuttleTimestamp(value: string | null) {
  if (!value) {
    return "Live now";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
}

function formatOperatingHoursMessage(message: string) {
  return message
    .replace(/^Our hours of operation are:\s*/i, "")
    .replace(/For more information, please call\s*/i, "Call ")
    .trim();
}

function splitOperatingHoursMessage(message: string) {
  return formatOperatingHoursMessage(message)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function createVehicleIcon(color: string | null) {
  const markerColor = color ?? "#006747";

  return L.divIcon({
    className: "bg-transparent border-none",
    html: `<div style="background:${markerColor}; box-shadow:0 0 0 4px rgba(255,255,255,0.78), 0 8px 20px rgba(0,0,0,0.18);" class="w-10 h-10 rounded-full flex items-center justify-center text-white"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.8.5-4c0-3.3-.7-6-4.5-6H6.5C2.7 8 2 10.7 2 14c0 2.2.5 4 .5 4H6"/><path d="M2 18h19"/><path d="M6 18v2"/><path d="M18 18v2"/></svg></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -16],
  });
}

function ShuttleMapViewport({ vehicles }: { vehicles: ShuttleVehicleRecord[] }) {
  const map = useMap();

  useEffect(() => {
    if (vehicles.length === 0) {
      map.flyTo(CAMPUS_CENTER, 15, { duration: 1.2 });
      return;
    }

    if (vehicles.length === 1) {
      const [vehicle] = vehicles;
      map.flyTo([vehicle.latitude, vehicle.longitude], 16, { duration: 1.2 });
      return;
    }

    const bounds = L.latLngBounds(vehicles.map((vehicle) => [vehicle.latitude, vehicle.longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
  }, [map, vehicles]);

  return null;
}

function getPrimaryRouteColor(route: ShuttleRouteRecord | undefined) {
  return route?.color ?? "var(--color-primary)";
}

export default function ShuttlePage() {
  const [overview, setOverview] = useState<ShuttleOverviewRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadOverview(isBackgroundRefresh = false) {
      if (!isBackgroundRefresh) {
        setIsLoading(true);
      }

      try {
        const nextOverview = await fetchShuttleOverview();
        if (!isCancelled) {
          setOverview(nextOverview);
          setError(null);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load live Bull Runner data.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadOverview();
    const intervalId = window.setInterval(() => {
      void loadOverview(true);
    }, 20000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const routes = overview?.routes ?? [];
  const filteredVehicles = useMemo(() => {
    if (!overview) {
      return [];
    }

    if (!selectedRouteId) {
      return overview.vehicles;
    }

    return overview.vehicles.filter((vehicle) => vehicle.routeId === selectedRouteId);
  }, [overview, selectedRouteId]);

  const selectedRoute = routes.find((route) => route.id === selectedRouteId);
  const selectedRouteColor = getPrimaryRouteColor(selectedRoute);
  const routeLookup = useMemo(() => new Map(routes.map((route) => [route.id, route])), [routes]);
  const sortedRoutes = useMemo(() => {
    return [...routes].sort((left, right) => right.activeVehicleCount - left.activeVehicleCount || left.name.localeCompare(right.name));
  }, [routes]);

  const headlineAlert = overview?.alerts[0] ?? null;
  const operatingHoursAlert = useMemo(() => {
    return overview?.alerts.find((alert) => {
      const title = alert.title.toLowerCase();
      const message = alert.message.toLowerCase();
      return title.includes("hours of operation") || message.includes("monday - thursday") || message.includes("saturday - sunday");
    }) ?? null;
  }, [overview]);
  const serviceNotices = useMemo(() => {
    if (!overview) {
      return [];
    }

    return overview.alerts.filter((alert) => alert.id !== operatingHoursAlert?.id);
  }, [operatingHoursAlert?.id, overview]);
  const operatingHoursLines = useMemo(() => {
    return operatingHoursAlert ? splitOperatingHoursMessage(operatingHoursAlert.message) : [];
  }, [operatingHoursAlert]);

  return (
    <div className="max-w-7xl mx-auto w-full px-6 md:px-12 pb-12">
      <section className="relative z-10 mb-10 pt-4">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="text-on-surface-variant font-body text-[10px] tracking-[0.22em] uppercase font-bold mb-2 block">Transit</span>
            <h1 className="font-headline text-4xl md:text-5xl font-bold text-primary tracking-tight">Bull Runner Live</h1>
            <p className="text-on-surface-variant text-sm md:text-base mt-3 max-w-2xl">
              Live USF shuttle routes, active buses, and service alerts from Passio for Bull Runner system #2343.
            </p>
          </div>

          <div className="glass-panel px-5 py-4 rounded-2xl flex items-center gap-4 self-start lg:self-auto">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] font-bold text-on-surface-variant">Last Sync</p>
              <p className="font-bold text-on-surface">{overview ? formatShuttleTimestamp(overview.fetchedAt) : "Loading..."}</p>
            </div>
          </div>
        </div>
      </section>

      {error && overview ? (
        <div className="glass-panel rounded-2xl p-4 border border-error/20 bg-error/5 mb-8 text-sm text-on-surface-variant">
          Showing the latest available shuttle snapshot. {error}
        </div>
      ) : null}

      {isLoading && !overview ? (
        <div className="glass-panel rounded-3xl p-10 text-on-surface-variant">Loading Bull Runner live data...</div>
      ) : error && !overview ? (
        <div className="glass-panel rounded-3xl p-10 border border-error/20 bg-error/5">
          <h2 className="font-headline text-2xl font-bold text-on-surface mb-2">Unable to load shuttle information</h2>
          <p className="text-sm text-on-surface-variant">{error}</p>
        </div>
      ) : overview ? (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <div className="glass-panel rounded-3xl p-6">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                <Bus className="w-5 h-5" />
              </div>
              <p className="font-headline text-3xl font-bold text-on-surface">{overview.activeVehicleCount}</p>
              <p className="text-sm text-on-surface-variant mt-2">Active buses currently reporting on campus.</p>
            </div>

            <div className="glass-panel rounded-3xl p-6">
              <div className="w-11 h-11 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary mb-4">
                <RouteIcon className="w-5 h-5" />
              </div>
              <p className="font-headline text-3xl font-bold text-on-surface">{overview.routeCount}</p>
              <p className="text-sm text-on-surface-variant mt-2">Bull Runner routes currently published by Passio.</p>
            </div>

            <div className="glass-panel rounded-3xl p-6">
              <div className="w-11 h-11 rounded-2xl bg-tertiary/10 flex items-center justify-center text-tertiary mb-4">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <p className="font-headline text-3xl font-bold text-on-surface">{serviceNotices.length}</p>
              <p className="text-sm text-on-surface-variant mt-2">Transit alerts or service notices posted right now.</p>
            </div>

            <div className="glass-panel rounded-3xl p-6">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                <Clock3 className="w-5 h-5" />
              </div>
              <p className="font-headline text-2xl font-bold text-on-surface">{overview.reportedTime ?? "Live"}</p>
              <p className="text-sm text-on-surface-variant mt-2">Passio-reported system time for this shuttle snapshot.</p>
            </div>
          </section>

          {selectedRoute ? (
            <section className="mb-8 rounded-3xl p-6 text-white shadow-[0_16px_40px_rgba(0,0,0,0.12)]" style={{ background: `linear-gradient(135deg, ${selectedRouteColor}, color-mix(in srgb, ${selectedRouteColor} 68%, black 32%))` }}>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <span className="text-white/70 font-body text-[10px] tracking-[0.22em] uppercase font-bold mb-2 block">Selected Route</span>
                  <h2 className="font-headline text-3xl font-bold tracking-tight">{selectedRoute.name}</h2>
                  <p className="text-sm text-white/80 mt-2 max-w-2xl">
                    {selectedRoute.activeVehicleCount > 0
                      ? `${selectedRoute.activeVehicleCount} live vehicle${selectedRoute.activeVehicleCount === 1 ? " is" : "s are"} currently reporting on this route.`
                      : "No buses are currently reporting on this route, but its service status and alerts remain visible."}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedRouteId(null)}
                  className="self-start rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/15 transition-colors"
                >
                  Clear Filter
                </button>
              </div>
            </section>
          ) : null}

          <section className="glass-panel rounded-3xl p-5 md:p-6 mb-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <span className="text-on-surface-variant font-body text-[10px] tracking-[0.22em] uppercase font-bold mb-2 block">Filter</span>
                <h2 className="font-headline text-2xl font-bold text-primary">Route Filter</h2>
                <p className="text-sm text-on-surface-variant mt-2">All Bull Runner routes stay visible here, even when no buses are currently active.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedRouteId(null)}
                  className={cn(
                    "rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-colors border",
                    !selectedRouteId
                      ? "bg-primary text-on-primary border-primary"
                      : "bg-surface-container-low text-on-surface-variant border-outline-variant/40 hover:bg-surface-container"
                  )}
                >
                  All Routes
                </button>
                {sortedRoutes.map((route) => (
                  <button
                    key={route.id}
                    onClick={() => setSelectedRouteId(route.id)}
                    className={cn(
                      "rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-colors border",
                      selectedRouteId === route.id
                        ? "text-on-primary border-transparent"
                        : "bg-surface-container-low text-on-surface-variant border-outline-variant/40 hover:bg-surface-container"
                    )}
                    style={selectedRouteId === route.id ? { backgroundColor: getPrimaryRouteColor(route) } : undefined}
                  >
                    {route.shortName || route.name}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-8">
            <div className="xl:col-span-8 glass-panel rounded-3xl overflow-hidden border" style={{ borderColor: selectedRoute ? `${selectedRouteColor}40` : undefined }}>
              <div className="px-6 py-5 border-b border-outline-variant/20 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <span className="text-on-surface-variant font-body text-[10px] tracking-[0.22em] uppercase font-bold mb-2 block">Map</span>
                  <h2 className="font-headline text-2xl font-bold text-primary">Live Bus Map</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-on-surface-variant">
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5" style={selectedRoute ? { backgroundColor: `${selectedRouteColor}18`, color: selectedRouteColor } : undefined}>
                    <MapPinned className="w-4 h-4 text-primary" />
                    {selectedRoute ? selectedRoute.name : "All routes"}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-surface-container px-3 py-1.5">
                    <Bus className="w-4 h-4 text-primary" />
                    {filteredVehicles.length} buses visible
                  </span>
                </div>
              </div>

              <div className="relative h-[420px]">
                <MapContainer center={CAMPUS_CENTER} zoom={15} className="h-full w-full" zoomControl={false}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <ShuttleMapViewport vehicles={filteredVehicles} />
                  {filteredVehicles.map((vehicle) => (
                    <Marker
                      key={vehicle.id}
                      position={[vehicle.latitude, vehicle.longitude]}
                      icon={createVehicleIcon(vehicle.color)}
                    >
                      <Popup>
                        <div className="min-w-[180px]">
                          <p className="font-bold">{vehicle.name}</p>
                          <p className="text-sm">{vehicle.routeName}</p>
                          <p className="text-sm">Speed: {vehicle.speed !== null ? `${Math.round(vehicle.speed)} mph` : "Unknown"}</p>
                          <p className="text-xs text-slate-500 mt-2">{vehicle.latitude.toFixed(5)}, {vehicle.longitude.toFixed(5)}</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>

                {filteredVehicles.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="glass-panel rounded-2xl px-5 py-4 text-center max-w-sm mx-4">
                      <p className="font-bold text-on-surface">No active buses visible</p>
                      <p className="text-sm text-on-surface-variant mt-2">
                        {selectedRoute ? `No vehicles are currently reporting on ${selectedRoute.name}.` : "Passio is not reporting any active Bull Runner vehicles right now."}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="xl:col-span-4 flex flex-col gap-6">
              <div className="glass-panel rounded-3xl p-6 border" style={{ borderColor: selectedRoute ? `${selectedRouteColor}28` : undefined }}>
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <span className="text-on-surface-variant font-body text-[10px] tracking-[0.22em] uppercase font-bold mb-2 block">Vehicles</span>
                    <h2 className="font-headline text-2xl font-bold text-primary">Live Buses</h2>
                  </div>
                  <span className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]">
                    {filteredVehicles.length}
                  </span>
                </div>

                <div className="space-y-3 max-h-[330px] overflow-y-auto pr-1">
                  {filteredVehicles.length === 0 ? (
                    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 text-sm text-on-surface-variant">
                      No live buses are available for this filter right now.
                    </div>
                  ) : (
                    filteredVehicles.map((vehicle) => (
                      <div key={vehicle.id} className="rounded-2xl border bg-surface-container-low p-4" style={{ borderColor: vehicle.color ? `${vehicle.color}33` : undefined }}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-on-surface">{vehicle.name}</p>
                            <p className="text-sm text-on-surface-variant mt-1">{vehicle.routeName}</p>
                          </div>
                          <span className="w-3 h-3 rounded-full shrink-0 mt-1" style={{ backgroundColor: vehicle.color ?? "var(--color-primary)" }} />
                        </div>
                        <p className="text-xs text-on-surface-variant mt-3">Speed {vehicle.speed !== null ? `${Math.round(vehicle.speed)} mph` : "unknown"}</p>
                        <p className="text-xs text-on-surface-variant mt-1">
                          Service hours {routeLookup.get(vehicle.routeId)?.serviceTimeShort ?? "not listed"}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="glass-panel rounded-3xl p-6 border" style={{ borderColor: selectedRoute ? `${selectedRouteColor}20` : undefined }}>
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <span className="text-on-surface-variant font-body text-[10px] tracking-[0.22em] uppercase font-bold mb-2 block">Alerts</span>
                    <h2 className="font-headline text-2xl font-bold text-primary">Service Notices</h2>
                  </div>
                  <span className="rounded-full bg-secondary/10 text-secondary px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]">
                    {serviceNotices.length}
                  </span>
                </div>

                <div className="space-y-3 max-h-[330px] overflow-y-auto pr-1">
                  {serviceNotices.length === 0 ? (
                    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 text-sm text-on-surface-variant">
                      No active Bull Runner alerts are currently posted.
                    </div>
                  ) : (
                    serviceNotices.map((alert) => (
                      <div key={alert.id} className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-on-surface">{alert.title}</p>
                            <p className="text-sm text-on-surface-variant mt-2">{alert.message}</p>
                            {(alert.from || alert.to || alert.updated) ? (
                              <p className="text-xs text-on-surface-variant mt-3">
                                {alert.updated ? `Updated ${formatShuttleTimestamp(alert.updated)}` : null}
                                {alert.from || alert.to ? ` • ${alert.from ?? "?"} to ${alert.to ?? "?"}` : ""}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          {operatingHoursAlert ? (
            <section className="glass-panel rounded-3xl p-6 md:p-7 mb-8 border border-primary/15 bg-[linear-gradient(135deg,rgba(0,103,71,0.08),rgba(0,103,71,0.02))]">
              <div className="flex items-start justify-between gap-5 flex-wrap">
                <div className="max-w-4xl flex-1 min-w-[280px]">
                  <span className="text-on-surface-variant font-body text-[10px] tracking-[0.22em] uppercase font-bold mb-2 block">Operating Hours</span>
                  <h2 className="font-headline text-2xl font-bold text-primary">{operatingHoursAlert.title}</h2>
                  <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {operatingHoursLines.map((line, index) => {
                      const isHighlight = /Monday - Thursday|Friday|Saturday - Sunday|Weekend Service/i.test(line);

                      return (
                        <div
                          key={`${operatingHoursAlert.id}-${index}`}
                          className={`rounded-2xl border px-4 py-3 ${isHighlight ? "border-primary/15 bg-surface-container-lowest shadow-[0_8px_20px_rgb(0,0,0,0.03)]" : "border-outline-variant/15 bg-surface-container-low/70"}`}
                        >
                          <p className={`text-sm leading-6 ${isHighlight ? "text-on-surface font-medium" : "text-on-surface-variant"}`}>{line}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="shrink-0 rounded-2xl bg-surface-container-lowest px-4 py-4 border border-outline-variant/20 min-w-[168px]">
                  <p className="text-xs uppercase tracking-[0.18em] font-bold text-on-surface-variant">Updated</p>
                  <p className="mt-2 font-headline text-xl font-bold text-on-surface">{formatShuttleTimestamp(operatingHoursAlert.updated)}</p>
                  {operatingHoursAlert.from || operatingHoursAlert.to ? (
                    <p className="mt-3 text-xs text-on-surface-variant leading-5">
                      Active {operatingHoursAlert.from ?? "?"} to {operatingHoursAlert.to ?? "?"}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          <section className="glass-panel rounded-3xl p-6 md:p-7">
            <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
              <div>
                <span className="text-on-surface-variant font-body text-[10px] tracking-[0.22em] uppercase font-bold mb-2 block">Routes</span>
                <h2 className="font-headline text-2xl font-bold text-primary">Route Overview</h2>
              </div>
              <Link to="/map?dest=fletcher-hub&navigate=1" className="text-on-surface font-bold flex items-center gap-2 hover:text-primary transition-colors">
                Open campus map <Navigation className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedRoutes.map((route) => (
                <button
                  key={route.id}
                  onClick={() => setSelectedRouteId((current) => (current === route.id ? null : route.id))}
                  className={cn(
                    "rounded-3xl border p-5 text-left transition-all bg-surface-container-lowest hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgb(0,0,0,0.04)]",
                    selectedRouteId === route.id ? "ring-1" : "border-outline-variant/25"
                  )}
                  style={selectedRouteId === route.id ? { borderColor: `${getPrimaryRouteColor(route)}66`, boxShadow: `0 0 0 1px ${getPrimaryRouteColor(route)}26` } : undefined}
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <p className="font-headline text-xl font-bold text-on-surface">{route.name}</p>
                      <p className="text-sm text-on-surface-variant mt-1">{route.shortName ?? "Bull Runner route"}</p>
                    </div>
                    <span className="w-4 h-4 rounded-full shrink-0 mt-1" style={{ backgroundColor: route.color ?? "var(--color-primary)" }} />
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]">
                      {route.activeVehicleCount} active
                    </span>
                    <span className={cn(
                      "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]",
                      route.activeVehicleCount > 0
                        ? "bg-secondary/10 text-secondary"
                        : "bg-surface-container text-on-surface-variant"
                    )}>
                      {route.activeVehicleCount > 0 ? "In service" : "No active bus"}
                    </span>
                  </div>

                  <p className="text-sm text-on-surface-variant mt-4">
                    Service hours: <span className="font-semibold text-on-surface">{route.serviceTimeShort ?? "Not listed"}</span>
                  </p>
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
