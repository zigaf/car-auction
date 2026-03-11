export interface IReview {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  createdAt: string;
}

export interface IReviewStats {
  average: number;
  total: number;
  distribution: Record<number, number>;
}
