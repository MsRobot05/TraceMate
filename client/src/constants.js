export const categories = ['Electronics', 'Stationery', 'Personal items', 'Accessories', 'Keys', 'Clothing', 'Other'];

export const campusLocations = [
  'MIT-WPU Main Gate', 'MIT-WPU Library', 'Academic Block', 'Canteen / Food Court', 'Auditorium',
  'Sports Ground', 'Parking Area', 'Hostel Area', 'Bus Stop near campus', 'Other campus location'
];

export const safeMeetingPoints = [
  'MIT-WPU main gate', 'Campus security / reception', 'Library reception', 'Canteen / food court', 'Other staffed public place'
];

export const makeEmptyForm = () => ({
  title: '', type: 'lost', category: 'Electronics', description: '', location: '',
  date: new Date().toISOString().slice(0, 10),
  contactName: '', contactEmail: '', contactPhone: '',
  safeMeetingPoint: 'MIT-WPU main gate', photos: []
});

const now = () => new Date().toISOString();
export const demoItems = [
  { _id: 'demo-1', title: 'Black wireless headphones', type: 'found', category: 'Electronics', description: 'Black over-ear headphones left near the reading area.', location: 'Central Library', date: now(), status: 'open' },
  { _id: 'demo-2', title: 'Blue student notebook', type: 'lost', category: 'Stationery', description: 'A blue notebook with handwritten lecture notes.', location: 'Block B, Room 204', date: now(), status: 'open' },
  { _id: 'demo-3', title: 'Silver water bottle', type: 'found', category: 'Personal items', description: 'A silver metal bottle found beside the benches.', location: 'Sports Ground', date: now(), status: 'open' },
  { _id: 'demo-4', title: 'Student ID card holder', type: 'lost', category: 'Accessories', description: 'A black card holder with a missing ID card.', location: 'Main Canteen', date: now(), status: 'open' }
];
