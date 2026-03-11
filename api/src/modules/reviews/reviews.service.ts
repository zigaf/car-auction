import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Review } from '../../db/entities/review.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { CreateReviewDto } from './dto/create-review.dto';

// Mixed: full names, first-name only, funny nicknames
const SEED_NAMES = [
  // Full names
  'Александр Петров', 'Мария Иванова', 'Дмитрий Козлов', 'Елена Смирнова',
  'Андрей Новиков', 'Анна Морозова', 'Сергей Волков', 'Ольга Соколова',
  'Михаил Лебедев', 'Наталья Попова', 'Иван Кузнецов', 'Татьяна Васильева',
  'Павел Соловьёв', 'Екатерина Зайцева', 'Николай Павлов', 'Юлия Семёнова',
  'Алексей Голубев', 'Виктория Виноградова', 'Роман Богданов', 'Светлана Воробьёва',
  'Владимир Федоров', 'Ирина Михайлова', 'Максим Беляев', 'Дарья Тарасова',
  'Артём Комаров', 'Анастасия Орлова', 'Денис Киселёв', 'Марина Макарова',
  'Евгений Андреев', 'Ксения Ковалёва',
  // First name only
  'Григорий', 'Валентина', 'Олег', 'Полина', 'Владислав',
  'Людмила', 'Константин', 'Вероника', 'Тимур', 'Кристина',
  'Артур', 'Диана', 'Руслан', 'Яна', 'Богдан',
  'Виталий', 'Лариса', 'Степан', 'Инна', 'Захар',
  // Funny nicknames
  'BMW хейтер', 'Авто_маньяк', 'Тачка мечты', 'Дизель Фан', 'Гонщик из Киева',
  'Седан Lover', 'VAG фанат', 'JDM Forever', 'Euro Driver', 'АвтоБид фан',
  'ТурбоДизель', 'Кроссовер Кинг', 'Дрифт Мастер', 'Без ДТП', 'Пробег реальный',
  'Мотор_ОК', 'Turbo Boost', 'Батя на минивэне', 'Подбор Авто', 'Евробляха',
];

const POSITIVE_TEXTS = [
  'Покупал {car} через эту платформу — всё прошло идеально. Прозрачные торги, честная цена, доставка точно в срок. Рекомендую всем, кто хочет купить авто из Европы без посредников.',
  'Долго выбирал {car}, сравнивал цены на разных площадках. Здесь оказалось выгоднее всего. Менеджер помог с документами, растаможка прошла быстро. Машина в отличном состоянии!',
  'Первый раз покупал машину на аукционе и немного переживал. Но команда AutoBid всё объяснила, провела через каждый этап. {car} приехал в идеальном состоянии. Спасибо!',
  'Заказал {car} — от момента выигрыша аукциона до доставки прошло 3 недели. Очень быстро для международной доставки. Состояние авто полностью соответствует описанию.',
  'Уже второй раз пользуюсь услугами AutoBid. В первый раз брал {car} для себя, теперь помог другу. Оба раза — безупречный сервис и выгодные цены.',
  'Отличная платформа! Купил {car} по цене значительно ниже рынка. Вся документация в порядке, доставка была организована профессионально. Однозначно буду обращаться ещё.',
  'Понравилось, что можно следить за торгами в реальном времени. Выиграл {car} с третьей попытки. Цена получилась на 30% ниже, чем у дилеров. Автомобиль в прекрасном состоянии.',
  'Очень удобный интерфейс, легко разобраться с торгами. Купил {car} — доставили за 2.5 недели.',
  'Брал {car} для работы. Цена, качество, сроки — всё на высоте. Менеджер был на связи 24/7, отвечал на все вопросы. Профессиональный подход к делу.',
  'Супер сервис! {car} доставили быстрее, чем ожидал. Состояние машины даже лучше, чем на фото. Растаможка и оформление — всё взяли на себя.',
  'Пользовался разными площадками, но AutoBid — лучшая по соотношению цена/сервис. Купил {car}, полностью доволен.',
  'Купил {car} жене в подарок. Весь процесс от регистрации до получения ключей занял меньше месяца. Жена в восторге, а я — от экономии.',
  'Честная платформа, без скрытых комиссий. {car} обошёлся мне на 40% дешевле, чем такой же на местном рынке. Качество автомобиля отличное.',
  'Оперативная работа команды. {car} нашли за неделю, аукцион прошёл гладко, доставка без задержек. Всем рекомендую для покупки европейских авто.',
  'Третий автомобиль беру через AutoBid — {car}. Ни разу не подвели. Всегда честные описания, адекватные цены и быстрая логистика.',
  'Заказал {car} из Германии. Переживал за состояние, но при осмотре всё оказалось даже лучше, чем в описании. Пробег реальный, кузов без повреждений.',
  'AutoBid — находка для тех, кто ценит время и деньги. {car} привезли за 18 дней, состояние идеальное. Документы все в порядке.',
  'Долго сомневался, стоит ли покупать авто на аукционе. Друг посоветовал AutoBid. Купил {car} — не жалею ни секунды. Экономия существенная.',
  'Профессионалы своего дела. {car} подобрали точно под мои требования. Торги прошли быстро, доставка — как по расписанию. Буду рекомендовать друзьям.',
  'Впечатлён скоростью работы. От выбора {car} до его получения прошло всего 20 дней. Автомобиль в безупречном состоянии. Цена — просто подарок.',
  'Удобно, что всё можно делать онлайн — от торгов до отслеживания доставки. {car} приехал в срок, никаких неожиданностей. Отличный сервис!',
  'Покупал {car} для бизнеса. Цена ниже рыночной на 35%. Доставка и растаможка прошли без проблем. Менеджер держал в курсе на каждом этапе.',
  'Рекомендую AutoBid всем! {car} — моя лучшая покупка за последний год. Качество, цена, сервис — всё на высшем уровне.',
  'Сначала казалось сложным, но с помощью команды AutoBid всё оказалось проще простого. {car} получил быстро, состояние отличное. Спасибо за помощь!',
  // Belarus customs — positive
  'Растаможка {car} через Беларусь прошла на удивление гладко. Всего 10 дней — и машина уже у меня. Менеджер всё оформил, я практически ничего не делал сам.',
  'Выбрал растаможку {car} через Беларусь — сэкономил ощутимо по сравнению с прямой растаможкой. Менеджер детально объяснил все этапы и возможные расходы.',
  '{car} растаможили через Беларусь за 12 дней. Быстро, прозрачно, без скрытых доплат. Менеджер на связи был постоянно, всё чётко.',
  'Друзья пугали, что растаможка через Беларусь — это сложно и долго. Но с AutoBid {car} оформили за 2 недели. Документы все на руках, машина в идеале.',
  'Гнал {car} через Беларусь — все документы подготовили заранее. На границе простоял всего 2 часа. Менеджер координировал каждый шаг.',
  'Растаможка {car} через Минск — лучшее решение. Экономия по сравнению с прямым ввозом около 20%. Рекомендую этот маршрут всем.',
];

const NEGATIVE_TEXTS = [
  'Менеджер мог бы работать повежливее. {car} приехал с задержкой в неделю, на таможне возникли проблемы с документами. В целом машина неплохая, но сервис оставляет желать лучшего.',
  'Растаможка {car} через Беларусь заняла намного больше времени, чем обещали. Ждал почти 2 месяца вместо 3 недель. Менеджер был грубоват, на вопросы отвечал с задержкой.',
  '{car} пришёл с мелкими царапинами, которых не было на фото. Менеджер сказал, что это «допустимые повреждения при транспортировке». Не совсем доволен таким подходом.',
  'Доставка {car} задержалась на 10 дней без внятных объяснений. Менеджер был недоступен 3 дня подряд. Машина нормальная, но нервов потратил прилично.',
  'На таможне возникли проблемы с документами на {car}. Пришлось доплачивать за какие-то «дополнительные услуги». Менеджер не предупредил заранее о возможных расходах.',
  '{car} в целом нормальный, но пробег оказался больше заявленного на 15 тысяч. Менеджер сухо ответил на мои претензии. Не лучший опыт покупки.',
  'Растаможка {car} через Беларусь превратилась в целую эпопею. Задержки на каждом этапе, какие-то непонятные доплаты. Менеджер хамил по телефону, когда я спрашивал о статусе.',
  'Купил {car}, но доставка заняла полтора месяца вместо обещанных трёх недель. Менеджер менялся 2 раза, никто не мог дать внятный статус по доставке.',
  '{car} приехал с разряженным аккумулятором и спущенным колесом. Мелочи, но неприятно за такие деньги. Растаможка затянулась из-за праздников, менеджер не предупредил.',
  'В целом норм, но ожидал большего за такие деньги. {car} имел мелкие дефекты, о которых не было ни слова в описании. Поддержка отвечала медленно.',
  'Таможня через Беларусь — отдельная история. {car} простоял на границе 2 недели. Менеджер только разводил руками и говорил «ждите».',
  '{car} получил, всё работает, но осадок остался. Менеджер был резковат в общении, на вопросы про доплаты отвечал нехотя. Больше не обращусь.',
  'Очень долго ждал {car}. Обещали 3 недели — в итоге 6. На вопросы отвечали шаблонами. Машина норм, но сервис нужно подтянуть.',
  'При растаможке {car} через Беларусь всплыли дополнительные платежи, о которых заранее не говорили. Менеджер сказал «все так делают». Неприятно.',
  '{car} описали как «идеальное состояние», а по факту — потёртости на бамперах и сколы на лобовом. Менеджер предложил скидку 50$. Серьёзно?',
];

const CARS = [
  'BMW 320d', 'BMW 520d', 'BMW X3', 'Audi A4', 'Audi A6', 'Audi Q5',
  'Mercedes C220', 'Mercedes E220', 'Mercedes GLC', 'Volkswagen Golf',
  'Volkswagen Passat', 'Volkswagen Tiguan', 'Toyota Camry', 'Toyota RAV4',
  'Skoda Octavia', 'Skoda Superb', 'Peugeot 308', 'Peugeot 3008',
  'Renault Megane', 'Volvo XC60', 'Volvo S60', 'Ford Focus', 'Hyundai Tucson',
  'Kia Sportage', 'Mazda CX-5', 'Honda CR-V',
];

const SEED_COUNT = 147;

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
    } else if (count === 100) {
      // Old seed — re-seed with updated data (147 reviews)
      const userReviews = await this.reviewRepository.count({
        where: { userId: Not(IsNull()) },
      });
      if (userReviews === 0) {
        this.logger.log('Re-seeding: replacing 100 old reviews with 147...');
        await this.reviewRepository.clear();
        await this.seed();
      }
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
    this.logger.log(`Seeding ${SEED_COUNT} reviews...`);

    const now = Date.now();
    const sixMonthsMs = 180 * 24 * 60 * 60 * 1000;
    const reviews: Partial<Review>[] = [];

    let posIdx = 0;
    let negIdx = 0;

    for (let i = 0; i < SEED_COUNT; i++) {
      const name = SEED_NAMES[i % SEED_NAMES.length];
      const car = CARS[i % CARS.length];

      // Rating distribution: 50% 5★, 30% 4★, 13% 3★, 5% 2★, 2% 1★
      let rating: number;
      const rand = Math.random();
      if (rand < 0.50) rating = 5;
      else if (rand < 0.80) rating = 4;
      else if (rand < 0.93) rating = 3;
      else if (rand < 0.98) rating = 2;
      else rating = 1;

      let text: string;
      if (rating >= 4) {
        text = POSITIVE_TEXTS[posIdx % POSITIVE_TEXTS.length].replace('{car}', car);
        posIdx++;
      } else {
        text = NEGATIVE_TEXTS[negIdx % NEGATIVE_TEXTS.length].replace('{car}', car);
        negIdx++;
      }

      const createdAt = new Date(now - Math.random() * sixMonthsMs);

      reviews.push({ authorName: name, rating, text, createdAt });
    }

    await this.reviewRepository.save(reviews);
    this.logger.log(`Seeded ${SEED_COUNT} reviews successfully`);
  }
}
