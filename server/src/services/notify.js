import Notification from '../models/Notification.js';

/** Fire-and-forget in-app notification. Failures never break the request that triggered them. */
export async function notify(userId, { type, title, body = '', link = '/my' }) {
  if (!userId) return null;
  try {
    return await Notification.create({ user: userId, type, title: title.slice(0, 160), body: body.slice(0, 400), link });
  } catch (error) {
    console.error('Could not create notification:', error.message);
    return null;
  }
}
