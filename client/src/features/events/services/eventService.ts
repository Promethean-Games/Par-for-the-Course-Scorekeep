import type { EventSummary } from "../types/event";

export interface IEventService {
  getFeaturedEvent(): Promise<EventSummary | null>;
  getUpcomingEvents(): Promise<EventSummary[]>;
  getEventById(eventId: string): Promise<EventSummary | null>;
}

class MockEventService implements IEventService {
  private async getUpcomingFromApi(): Promise<EventSummary[]> {
    const response = await fetch("/api/events/upcoming");
    if (!response.ok) {
      throw new Error("Failed to fetch events");
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  async getFeaturedEvent(): Promise<EventSummary | null> {
    const upcoming = await this.getUpcomingFromApi();
    return upcoming[0] ?? null;
  }

  async getUpcomingEvents(): Promise<EventSummary[]> {
    return this.getUpcomingFromApi();
  }

  async getEventById(eventId: string): Promise<EventSummary | null> {
    const upcoming = await this.getUpcomingFromApi();
    return upcoming.find((event) => event.id === eventId) ?? null;
  }
}

export const eventService: IEventService = new MockEventService();

