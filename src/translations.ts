export type Language = 'en' | 'km';

export interface Translations {
  [key: string]: {
    en: string;
    km: string;
  };
}

export const translations: Translations = {
  appName: {
    en: 'Modern AC Management System',
    km: 'ប្រព័ន្ធគ្រប់គ្រងសហគមន៍កសិកម្មទំនើប',
  },
  welcome: {
    en: 'Welcome to the Modern Agricultural Community Management System. Please sign in to continue.',
    km: 'សូមស្វាគមន៍មកកាន់ប្រព័ន្ធគ្រប់គ្រងសហគមន៍កសិកម្មទំនើប។ សូមចូលដើម្បីបន្ត។',
  },
  signIn: {
    en: 'Sign in with Google',
    km: 'ចូលជាមួយ Google',
  },
  dashboard: {
    en: 'Dashboard',
    km: 'ផ្ទាំងគ្រប់គ្រង',
  },
  members: {
    en: 'Members',
    km: 'សមាជិក',
  },
  crops: {
    en: 'Cropping Calendar',
    km: 'ប្រតិទិនដំណាំ',
  },
  store: {
    en: 'AC Store',
    km: 'ហាងសហគមន៍',
  },
  loans: {
    en: 'Loans',
    km: 'កម្ចី',
  },
  accounting: {
    en: 'Accounting',
    km: 'គណនេយ្យ',
  },
  logout: {
    en: 'Logout',
    km: 'ចាកចេញ',
  },
  settings: {
    en: 'Settings',
    km: 'ការកំណត់',
  },
  search: {
    en: 'Search...',
    km: 'ស្វែងរក...',
  },
  totalMembers: {
    en: 'Total Members',
    km: 'សមាជិកសរុប',
  },
  activeCrops: {
    en: 'Active Crops',
    km: 'ដំណាំកំពុងដាំដុះ',
  },
  totalSales: {
    en: 'Total Sales',
    km: 'ការលក់សរុប',
  },
  loanBalance: {
    en: 'Loan Balance',
    km: 'សមតុល្យកម្ចី',
  },
  yieldVsRevenue: {
    en: 'Yield vs Revenue',
    km: 'ទិន្នផល និង ចំណូល',
  },
  monthlyPerformance: {
    en: 'Monthly performance overview',
    km: 'ទិដ្ឋភាពទូទៅនៃប្រតិបត្តិការប្រចាំខែ',
  },
  salesByCategory: {
    en: 'Sales by Category',
    km: 'ការលក់តាមប្រភេទ',
  },
  topPerformingProducts: {
    en: 'Top performing product groups',
    km: 'ក្រុមផលិតផលដែលមានប្រតិបត្តិការល្អបំផុត',
  },
  recentActivity: {
    en: 'Recent Activity',
    km: 'សកម្មភាពថ្មីៗ',
  },
  view: {
    en: 'View',
    km: 'មើល',
  },
  addMember: {
    en: 'Add Member',
    km: 'បន្ថែមសមាជិក',
  },
  active: {
    en: 'Active',
    km: 'សកម្ម',
  },
  inactive: {
    en: 'Inactive',
    km: 'អសកម្ម',
  },
  pending: {
    en: 'Pending',
    km: 'រង់ចាំ',
  },
  all: {
    en: 'All',
    km: 'ទាំងអស់',
  },
  memberDetails: {
    en: 'Member Details',
    km: 'ព័ត៌មានលម្អិតសមាជិក',
  },
  fullName: {
    en: 'Full Name',
    km: 'ឈ្មោះពេញ',
  },
  gender: {
    en: 'Gender',
    km: 'ភេទ',
  },
  phone: {
    en: 'Phone',
    km: 'ទូរស័ព្ទ',
  },
  address: {
    en: 'Address',
    km: 'អាសយដ្ឋាន',
  },
  status: {
    en: 'Status',
    km: 'ស្ថានភាព',
  },
  save: {
    en: 'Save',
    km: 'រក្សាទុក',
  },
  cancel: {
    en: 'Cancel',
    km: 'បោះបង់',
  },
  delete: {
    en: 'Delete',
    km: 'លុប',
  },
  actions: {
    en: 'Actions',
    km: 'សកម្មភាព',
  },
  selected: {
    en: 'selected',
    km: 'បានជ្រើសរើស',
  },
  membersSelected: {
    en: 'Members Selected',
    km: 'សមាជិកដែលបានជ្រើសរើស',
  },
  clearSelection: {
    en: 'Clear Selection',
    km: 'សម្អាតការជ្រើសរើស',
  },
  markAsActive: {
    en: 'Mark as Active',
    km: 'កំណត់ជាសកម្ម',
  },
  markAsInactive: {
    en: 'Mark as Inactive',
    km: 'កំណត់ជាអសកម្ម',
  },
  markAsPending: {
    en: 'Mark as Pending',
    km: 'កំណត់ជារង់ចាំ',
  },
  allMembers: {
    en: 'All Members',
    km: 'សមាជិកទាំងអស់',
  },
  confirmDelete: {
    en: 'Are you sure you want to delete',
    km: 'តើអ្នកប្រាកដជាចង់លុប',
  },
  selectAll: {
    en: 'Select All',
    km: 'ជ្រើសរើសទាំងអស់',
  },
  filter: {
    en: 'Filter',
    km: 'ចម្រោះ',
  },
  totalOutstanding: {
    en: 'Total Outstanding',
    km: 'សមតុល្យជំពាក់សរុប',
  },
  pendingApplications: {
    en: 'Pending Applications',
    km: 'ពាក្យស្នើសុំរង់ចាំ',
  },
  fullyRepaid: {
    en: 'Fully Repaid',
    km: 'បានសងរួចរាល់',
  },
  newApplication: {
    en: 'New Application',
    km: 'ពាក្យស្នើសុំថ្មី',
  },
  loanPayments: {
    en: 'Loan Payments',
    km: 'ការសងប្រាក់កម្ចី',
  },
  paymentHistory: {
    en: 'Payment History',
    km: 'ប្រវត្តិនៃការសង',
  },
  addPayment: {
    en: 'Add Payment',
    km: 'បន្ថែមការសង',
  },
  totalPaid: {
    en: 'Total Paid',
    km: 'សរុបបានសង',
  },
  remainingPrincipal: {
    en: 'Remaining Principal',
    km: 'ប្រាក់ដើមនៅសល់',
  },
  amount: {
    en: 'Amount',
    km: 'ចំនួនទឹកប្រាក់',
  },
  interest: {
    en: 'Interest',
    km: 'ការប្រាក់',
  },
  term: {
    en: 'Term',
    km: 'រយៈពេល',
  },
  principal: {
    en: 'Principal',
    km: 'ប្រាក់ដើម',
  },
  date: {
    en: 'Date',
    km: 'កាលបរិច្ឆេទ',
  },
  recordPayment: {
    en: 'Record Payment',
    km: 'កត់ត្រាការសង',
  },
  submitApplication: {
    en: 'Submit Application',
    km: 'ដាក់ពាក្យស្នើសុំ',
  },
  repaid: {
    en: 'Repaid',
    km: 'បានសងរួចរាល់',
  },
  approved: {
    en: 'Approved',
    km: 'បានអនុម័ត',
  },
  selectMember: {
    en: 'Select a member',
    km: 'ជ្រើសរើសសមាជិក',
  },
  paymentDate: {
    en: 'Payment Date',
    km: 'កាលបរិច្ឆេទសង',
  },
  totalAmount: {
    en: 'Total Amount',
    km: 'ចំនួនទឹកប្រាក់សរុប',
  },
  noPaymentsRecorded: {
    en: 'No payments recorded yet',
    km: 'មិនទាន់មានការកត់ត្រាការសងនៅឡើយទេ',
  },
  noLoanApplicationsFound: {
    en: 'No loan applications found',
    km: 'រកមិនឃើញពាក្យស្នើសុំកម្ចីទេ',
  },
  allRightsReserved: {
    en: 'All Rights Reserved | Mr. Long Puthdano',
    km: 'រក្សាសិទ្ធិគ្រប់យ៉ាង | លោក ឡុង ពុទ្ធដាណូ',
  },
  contactTelegram: {
    en: 'Contact me via 0967533375 (Telegram)',
    km: 'ទំនាក់ទំនងខ្ញុំតាមរយៈ ០៩៦៧៥៣៣៣៧៥ (តេឡេក្រាម)',
  },
  scanToConnect: {
    en: 'Scan to connect',
    km: 'ស្កេនដើម្បីភ្ជាប់ទំនាក់ទំនង',
  },
  importCSV: {
    en: 'Import CSV',
    km: 'នាំចូល CSV',
  },
  exportCSV: {
    en: 'Export CSV',
    km: 'នាំចេញ CSV',
  },
  qrCode: {
    en: 'QR Code',
    km: 'កូដ QR',
  },
  scanToViewProfile: {
    en: 'Scan to view member profile',
    km: 'ស្កេនដើម្បីមើលព័ត៌មានសមាជិក',
  },
  downloadQR: {
    en: 'Download QR',
    km: 'ទាញយក QR',
  },
  seedData: {
    en: 'Seed Test Data',
    km: 'បញ្ចូលទិន្នន័យសាកល្បង',
  },
  seeding: {
    en: 'Seeding...',
    km: 'កំពុងបញ្ចូល...',
  },
};
