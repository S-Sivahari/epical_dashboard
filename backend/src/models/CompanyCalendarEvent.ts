import { ObjectId } from 'mongodb';

export interface CompanyCalendarEvent {
  _id?: ObjectId;
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm (optional)
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
