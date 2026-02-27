import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface ITask {
  id: string;
  targetUserId: string;
  targetUser?: { id: string; firstName: string; lastName: string; email: string };
  assignedToId: string;
  assignedTo?: { id: string; firstName: string; lastName: string };
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ITasksResponse {
  data: ITask[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateTaskPayload {
  targetUserId: string;
  assignedToId: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  dueDate?: string;
}

export interface UpdateTaskPayload {
  assignedToId?: string;
  title?: string;
  description?: string;
  status?: TaskStatus;
  dueDate?: string;
}

@Injectable({ providedIn: 'root' })
export class TaskService {
  constructor(private readonly api: ApiService) {}

  getTasks(params: {
    assignedToId?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}): Observable<ITasksResponse> {
    return this.api.get<ITasksResponse>('/tasks', {
      assignedToId: params.assignedToId,
      status: params.status,
      page: params.page ?? 1,
      limit: params.limit ?? 20,
    });
  }

  getTasksByUser(userId: string): Observable<ITask[]> {
    return this.api.get<ITask[]>(`/tasks/user/${userId}`);
  }

  createTask(payload: CreateTaskPayload): Observable<ITask> {
    return this.api.post<ITask>('/tasks', payload);
  }

  updateTask(id: string, payload: UpdateTaskPayload): Observable<ITask> {
    return this.api.patch<ITask>(`/tasks/${id}`, payload);
  }

  deleteTask(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/tasks/${id}`);
  }
}
