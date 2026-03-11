import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '../../db/entities/review.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { CreateReviewDto } from './dto/create-review.dto';

const SEED_NAMES = [
  'Александр Петров', 'Мария Иванова', 'Дмитрий Козлов', 'Елена Смирнова',
  'Андрей Новиков', 'Анна Морозова', 'Сергей Волков', 'Ольга Соколова',
  'Михаил Лебедев', 'Наталья Попова', 'Иван Кузнецов', 'Татьяна Васильева',
  'Павел Соловьёв', 'Екатерина Зайцева', 'Николай Павлов', 'Юлия Семёнова',
  'Алексей Голубев', 'Виктория Виноградова', 'Роман Богданов', 'Светлана Воробьёва',
  'Владимир Федоров', 'Ирина Михайлова', 'Максим Беляев', 'Дарья Тарасова',
  'Артём Комаров', 'Анастасия Орлова', 'Денис Киселёв', 'Марина Макарова',
  'Евгений Андреев', 'Ксения Ковалёва', 'Григорий Ильин', 'Валентина Гусева',
  'Олег Титов', 'Полина Кудрявцева', 'Владислав Баранов', 'Людмила Куликова',
  'Константин Алексеев', 'Вероника Степанова', 'Тимур Николаев', 'Кристина Захарова',
];

const SEED_TEXTS = [
  'Покупал {car} через эту платформу — всё прошло идеально. Прозрачные торги, честная цена, доставка точно в срок. Рекомендую всем, кто хочет купить авто из Европы без посредников.',
  'Долго выбирал {car}, сравнивал цены на разных площадках. Здесь оказалось выгоднее всего. Менеджер помог с документами, растаможка прошла быстро. Машина в отличном состоянии!',
  'Первый раз покупал машину на аукционе и немного переживал. Но команда AutoBid всё объяснила, провела через каждый этап. {car} приехал в идеальном состоянии. Спасибо!',
  'Заказал {car} — от момента выигрыша аукциона до доставки прошло 3 недели. Очень быстро для международной доставки. Состояние авто полностью соответствует описанию.',
  'Уже второй раз пользуюсь услугами AutoBid. В первый раз брал {car} для себя, теперь помог другу. Оба раза — безупречный сервис и выгодные цены.',
  'Отличная платформа! Купил {car} по цене значительно ниже рынка. Вся документация в порядке, доставка была организована профессионально. Однозначно буду обращаться ещё.',
  'Понравилось, что можно следить за торгами в реальном времени. Выиграл {car} с третьей попытки. Цена получилась на 30% ниже, чем у дилеров. Автомобиль в прекрасном состоянии.',
  'Очень удобный интерфейс, легко разобраться с торгами. Купил {car} — доставили за 2.5 недели. Единственный минус — хотелось бы больше фотографий в объявлениях.',
  'Брал {car} для работы. Цена, качество, сроки — всё на высоте. Менеджер был на связи 24/7, отвечал на все вопросы. Профессиональный подход к делу.',
  'Супер сервис! {car} доставили быстрее, чем ожидал. Состояние машины даже лучше, чем на фото. Растаможка и оформление — всё взяли на себя.',
  'Пользовался разными площадками, но AutoBid — лучшая по соотношению цена/сервис. Купил {car}, полностью доволен. Калькулятор доставки очень точный.',
  'Купил {car} жене в подарок. Весь процесс от регистрации до получения ключей занял меньше месяца. Жена в восторге, а я — от экономии.',
  'Честная платформа, без скрытых комиссий. {car} обошёлся мне на 40% дешевле, чем такой же на местном рынке. Качество автомобиля отличное.',
  'Оперативная работа команды. {car} нашли за неделю, аукцион прошёл гладко, доставка без задержек. Всем рекомендую для покупки европейских авто.',
  'Третий автомобиль беру через AutoBid — {car}. Ни разу не подвели. Всегда честные описания, адекватные цены и быстрая логистика.',
  'Заказал {car} из Германии. Переживал за состояние, но при осмотре всё оказалось даже лучше, чем в описании. Пробег реальный, кузов без повреждений.',
  'Хорошая платформа. {car} купил за разумные деньги. Единственное пожелание — добавить видео-осмотр лотов. В остальном всё отлично.',
  'AutoBid — находка для тех, кто ценит время и деньги. {car} привезли за 18 дней, состояние идеальное. Документы все в порядке.',
  'Долго сомневался, стоит ли покупать авто на аукционе. Друг посоветовал AutoBid. Купил {car} — не жалею ни секунды. Экономия существенная.',
  'Профессионалы своего дела. {car} подобрали точно под мои требования. Торги прошли быстро, доставка — как по расписанию. Буду рекомендовать друзьям.',
  'Впечатлён скоростью работы. От выбора {car} до его получения прошло всего 20 дней. Автомобиль в безупречном состоянии. Цена — просто подарок.',
  'Удобно, что всё можно делать онлайн — от торгов до отслеживания доставки. {car} приехал в срок, никаких неожиданностей. Отличный сервис!',
  'Покупал {car} для бизнеса. Цена ниже рыночной на 35%. Доставка и растаможка прошли без проблем. Менеджер держал в курсе на каждом этапе.',
  'Рекомендую AutoBid всем! {car} — моя лучшая покупка за последний год. Качество, цена, сервис — всё на высшем уровне.',
  'Сначала казалось сложным, но с помощью команды AutoBid всё оказалось проще простого. {car} получил быстро, состояние отличное. Спасибо за помощь!',
];

const CARS = [
  'BMW 320d', 'BMW 520d', 'BMW X3', 'Audi A4', 'Audi A6', 'Audi Q5',
  'Mercedes C220', 'Mercedes E220', 'Mercedes GLC', 'Volkswagen Golf',
  'Volkswagen Passat', 'Volkswagen Tiguan', 'Toyota Camry', 'Toyota RAV4',
  'Skoda Octavia', 'Skoda Superb', 'Peugeot 308', 'Peugeot 3008',
  'Renault Megane', 'Volvo XC60', 'Volvo S60', 'Ford Focus', 'Hyundai Tucson',
  'Kia Sportage', 'Mazda CX-5', 'Honda CR-V',
];

@Injectable()
export class ReviewsService implements OnModuleInit {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    private readonly notificationService: NotificationService,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.reviewRepository.count();
    if (count === 0) {
      await this.seed();
    }
  }

  async getAll(
    page = 1,
    limit = 20,
  ): Promise<{
    data: Review[];
    total: number;
    page: number;
    limit: number;
  }> {
    const [data, total] = await this.reviewRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async getStats(): Promise<{
    average: number;
    total: number;
    distribution: Record<number, number>;
  }> {
    const result = await this.reviewRepository
      .createQueryBuilder('r')
      .select('AVG(r.rating)', 'average')
      .addSelect('COUNT(*)', 'total')
      .getRawOne();

    const distRows = await this.reviewRepository
      .createQueryBuilder('r')
      .select('r.rating', 'rating')
      .addSelect('COUNT(*)', 'count')
      .groupBy('r.rating')
      .getRawMany();

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of distRows) {
      distribution[Number(row.rating)] = Number(row.count);
    }

    return {
      average: parseFloat(Number(result.average).toFixed(1)),
      total: Number(result.total),
      distribution,
    };
  }

  async create(
    userId: string,
    authorName: string,
    dto: CreateReviewDto,
  ): Promise<Review> {
    const review = this.reviewRepository.create({
      userId,
      authorName,
      rating: dto.rating,
      text: dto.text,
    });

    const saved = await this.reviewRepository.save(review);

    this.notificationService
      .create({
        userId,
        type: NotificationType.NEW_REVIEW,
        title: 'Отзыв опубликован',
        message: `Ваш отзыв с оценкой ${dto.rating} успешно опубликован. Спасибо за обратную связь!`,
        data: { reviewId: saved.id },
      })
      .catch((err) => this.logger.error('Failed to create review notification', err));

    return saved;
  }

  private async seed(): Promise<void> {
    this.logger.log('Seeding 100 reviews...');

    const now = Date.now();
    const sixMonthsMs = 180 * 24 * 60 * 60 * 1000;
    const reviews: Partial<Review>[] = [];

    for (let i = 0; i < 100; i++) {
      const name = SEED_NAMES[i % SEED_NAMES.length];
      const car = CARS[i % CARS.length];
      const template = SEED_TEXTS[i % SEED_TEXTS.length];
      const text = template.replace('{car}', car);

      let rating: number;
      const rand = Math.random();
      if (rand < 0.50) rating = 5;
      else if (rand < 0.80) rating = 4;
      else if (rand < 0.95) rating = 3;
      else rating = 2;

      const createdAt = new Date(now - Math.random() * sixMonthsMs);

      reviews.push({
        authorName: name,
        rating,
        text,
        createdAt,
      });
    }

    await this.reviewRepository.save(reviews);
    this.logger.log('Seeded 100 reviews successfully');
  }
}
