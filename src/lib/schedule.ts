export const SCHEDULE_DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
] as const;

export type ScheduleDay = (typeof SCHEDULE_DAYS)[number]["key"];

export const SCHEDULE_SLOTS = [
  { key: "09:30", startLabel: "9:30 AM", endLabel: "10:30 AM" },
  { key: "10:30", startLabel: "10:30 AM", endLabel: "11:30 AM" },
  { key: "11:30", startLabel: "11:30 AM", endLabel: "12:30 PM" },
  { key: "13:30", startLabel: "1:30 PM", endLabel: "2:30 PM" },
  { key: "14:30", startLabel: "2:30 PM", endLabel: "3:30 PM" },
  { key: "15:30", startLabel: "3:30 PM", endLabel: "4:30 PM" },
  { key: "16:30", startLabel: "4:30 PM", endLabel: "5:30 PM" },
  { key: "17:30", startLabel: "5:30 PM", endLabel: "6:30 PM" },
] as const;

export type ScheduleSlotKey = (typeof SCHEDULE_SLOTS)[number]["key"];

export function isScheduleDay(value: string): value is ScheduleDay {
  return SCHEDULE_DAYS.some((day) => day.key === value);
}

export function isScheduleSlotKey(value: string): value is ScheduleSlotKey {
  return SCHEDULE_SLOTS.some((slot) => slot.key === value);
}

export function getScheduleSlot(slotKey: string) {
  return SCHEDULE_SLOTS.find((slot) => slot.key === slotKey) ?? null;
}
