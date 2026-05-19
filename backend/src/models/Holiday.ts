import { ObjectId } from 'mongodb';

export interface Holiday {
  _id?: ObjectId;
  id: string;
  title: string;
  date: string;
  createdAt?: Date;
}
