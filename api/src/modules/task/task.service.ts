import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTask, TaskStatus } from '../../db/entities/user-task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(UserTask)
    private readonly taskRepository: Repository<UserTask>,
  ) {}

  async findAll(query: {
    assignedToId?: string;
    status?: TaskStatus;
    page?: number;
    limit?: number;
  }): Promise<{ data: UserTask[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);

    const qb = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.targetUser', 'targetUser')
      .leftJoinAndSelect('task.assignedTo', 'assignedTo')
      .orderBy('task.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.assignedToId) {
      qb.andWhere('task.assignedToId = :assignedToId', {
        assignedToId: query.assignedToId,
      });
    }

    if (query.status) {
      qb.andWhere('task.status = :status', { status: query.status });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findByUser(targetUserId: string): Promise<UserTask[]> {
    return this.taskRepository.find({
      where: { targetUserId },
      relations: ['assignedTo'],
      order: { createdAt: 'DESC' },
    });
  }

  async create(dto: CreateTaskDto): Promise<UserTask> {
    const task = this.taskRepository.create({
      targetUserId: dto.targetUserId,
      assignedToId: dto.assignedToId,
      title: dto.title,
      description: dto.description ?? null,
      status: dto.status ?? TaskStatus.TODO,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
    });
    return this.taskRepository.save(task);
  }

  async update(id: string, dto: UpdateTaskDto): Promise<UserTask> {
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');

    if (dto.assignedToId !== undefined) task.assignedToId = dto.assignedToId;
    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.status !== undefined) task.status = dto.status;
    if (dto.dueDate !== undefined) {
      task.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }

    return this.taskRepository.save(task);
  }

  async remove(id: string): Promise<void> {
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    await this.taskRepository.remove(task);
  }
}
