import { ObjectId } from 'mongodb';

export interface TimesheetEntry {
  _id?: ObjectId;
  id: string;
  employeeId: string;
  employeeName: string;
  project: string;
  client?: string;
  date: string;
  hours: number;
  task: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateTimesheetPayload {
  employeeId: string;
  employeeName: string;
  project: string;
  client?: string;
  date: string;
  hours: number;
  task: string;
}
