import { ObjectId } from 'mongodb';

export interface Holiday {
  _id?: ObjectId;
  id: string;
  title: string;
  date: string;
  description?: string;
  type: 'National' | 'Company' | 'Optional' | 'Company Event';
  createdAt?: Date;
  updatedAt?: Date;
}
