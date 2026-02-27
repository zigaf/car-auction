import { Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { TaskService, ITask, TaskStatus } from '../../core/services/task.service';
import { AuthService } from '../../core/services/auth.service';

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'Сделать',
  IN_PROGRESS: 'В работе',
  DONE: 'Готово',
};

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  TODO: 'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
  DONE: 'TODO',
};

@Component({
  selector: 'app-user-tasks',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './user-tasks.component.html',
  styleUrl: './user-tasks.component.scss',
})
export class UserTasksComponent implements OnInit {
  @Input() userId = '';

  private readonly taskService = inject(TaskService);
  private readonly authService = inject(AuthService);

  tasks: ITask[] = [];
  loading = true;
  showForm = false;

  newTitle = '';
  newDescription = '';
  newDueDate = '';
  creating = false;

  readonly statusLabels = STATUS_LABELS;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.taskService.getTasksByUser(this.userId).subscribe({
      next: (tasks) => {
        this.tasks = tasks;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  createTask(): void {
    if (!this.newTitle.trim()) return;
    const managerId = this.authService.currentUser?.id ?? '';
    this.creating = true;
    this.taskService
      .createTask({
        targetUserId: this.userId,
        assignedToId: managerId,
        title: this.newTitle.trim(),
        description: this.newDescription || undefined,
        dueDate: this.newDueDate || undefined,
      })
      .subscribe({
        next: (t) => {
          this.tasks = [t, ...this.tasks];
          this.newTitle = '';
          this.newDescription = '';
          this.newDueDate = '';
          this.showForm = false;
          this.creating = false;
        },
        error: () => (this.creating = false),
      });
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
      },
    });
  }

  statusClass(status: TaskStatus): string {
    return { TODO: 'badge--gray', IN_PROGRESS: 'badge--amber', DONE: 'badge--green' }[status] ?? '';
  }
}
