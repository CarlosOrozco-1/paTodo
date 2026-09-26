export class NotSupportedError extends Error {
  constructor(message = 'Este módulo aún no está disponible en el backend') {
    super(message);
    this.name = 'NotSupportedError';
  }
}

export { realAuth } from './real-auth';
export { realUsers } from './real-users';
export { realCategories, realSkills } from './real-categories';
export { realJobs } from './real-jobs';
export { realOffers } from './real-offers';
export { realReviews } from './real-reviews';
export { realNotifications } from './real-notifications';
export { realConversations, realMessages } from './real-messages';
export { realAdmin } from './real-admin';