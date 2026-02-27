import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TaskService, ITask, TaskStatus } from '../../core/services/task.service';

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'Сделать',
  IN_PROGRESS: 'В работе',
  DONE: 'Готово',
};

const STATUS_CLASS: Record<TaskStatus, string> = {
  TODO: 'badge--gray',
  IN_PROGRESS: 'badge--amber',
  DONE: 'badge--green',
};

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  TODO: 'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
  DONE: 'TODO',
};

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss',
})
export class TasksPage implements OnInit {
  private readonly taskService = inject(TaskService);

  tasks: ITask[] = [];
  total = 0;
  page = 1;
  limit = 20;
  loading = true;
  error = '';

  filterStatus = '';

  readonly statusLabels = STATUS_LABELS;
  readonly statusClass = STATUS_CLASS;
  readonly statuses: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.taskService
      .getTasks({
        status: this.filterStatus || undefined,
        page: this.page,
        limit: this.limit,
      })
      .subscribe({
        next: (res) => {
          this.tasks = res.data;
          this.total = res.total;
          this.loading = false;
        },
        error: () => {
          this.error = 'Не удалось загрузить задачи';
          this.loading = false;
        },
      });
  }

  onFilterChange(): void {
    this.page = 1;
    this.load();
  }

  cycleStatus(task: ITask): void {
    const next = NEXT_STATUS[task.status];
    this.taskService.updateTask(task.id, { status: next }).subscribe({
      next: (updated) => {
        const idx = this.tasks.findIndex((t) => t.id === task.id);
        if (idx !== -1) this.tasks[idx] = updated;
      },
    });
  }

  deleteTask(id: string): void {
    this.taskService.deleteTask(id).subscribe({
      next: () => {
        this.tasks = this.tasks.filter((t) => t.id !== id);
        this.total--;
      },
    });
  }

  prevPage(): void {
    if (this.page > 1) { this.page--; this.load(); }
  }

  nextPage(): void {
    if (this.page * this.limit < this.total) { this.page++; this.load(); }
  }

  get totalPages(): number {
    return Math.ceil(this.total / this.limit);
  }
}
