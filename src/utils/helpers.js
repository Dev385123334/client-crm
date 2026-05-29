// Parse "D/Month/YYYY" format from Google Sheets
const monthNames = {
  January: '01', February: '02', March: '03', April: '04',
  May: '05', June: '06', July: '07', August: '08',
  September: '09', October: '10', November: '11', December: '12'
};

export function parseGoogleSheetDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const [day, monthName, year] = parts;
  const monthNum = monthNames[monthName];
  if (!monthNum) return null;
  const paddedDay = day.padStart(2, '0');
  return `${year}-${monthNum}-${paddedDay}`;
}

// Format ISO date to DD/MM/YYYY
export function formatDate(isoDate) {
  if (!isoDate) return '—';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

// Calculate tenure strictly based on billing cycle (month and year)
export function calculateTenure(onboardingDate, currentMonth, currentYear) {
  if (!onboardingDate) return { text: '—', months: 0 };
  
  const [year, month] = onboardingDate.split('-').map(Number);
  const curMonth = parseInt(currentMonth);
  const curYear = parseInt(currentYear);

  // Future date check
  if (year > curYear || (year === curYear && month > curMonth)) {
    return { text: '⚠️ Future date', months: 0, isFuture: true };
  }

  const tenureMonths = ((curYear - year) * 12) + (curMonth - month) + 1;
  const finalMonths = Math.max(1, tenureMonths);
  
  return { text: `${finalMonths} months`, months: finalMonths };
}

// Calculate dynamic payment alert (diffDays)
export function getPaymentAlert(client, currentMonth, currentYear) {
  const onboardDay = parseInt(client.onboardingDate.split('-')[2]);
  const viewMonth = parseInt(currentMonth);
  const viewYear = parseInt(currentYear);

  // Get last day of the viewed month
  const lastDayOfMonth = new Date(viewYear, viewMonth, 0).getDate();
  const dueDay = Math.min(onboardDay, lastDayOfMonth);

  const dueDate = new Date(viewYear, viewMonth - 1, dueDay);
  
  // Real today (start of day)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return { dueDate, diffDays };
}

// Get payment details
export function getPaymentStatus(client, payments, currentMonth, currentYear) {
  const p = payments.find(
    p => p.clientId === client.id && p.month === currentMonth && p.year === currentYear
  );
  
  if (p && p.receivedAmount > 0) {
    const net = (p.receivedAmount || 0) - (p.refundAmount || 0) - (p.chargebackAmount || 0);
    return {
      hasPayment: true,
      received: p.receivedAmount,
      refund: p.refundAmount || 0,
      chargeback: p.chargebackAmount || 0,
      net: net,
      label: 'PAID',
      type: 'success',
      emoji: '🟢'
    };
  }

  const { diffDays } = getPaymentAlert(client, currentMonth, currentYear);

  let label = '';
  let type = '';
  let emoji = '';

  if (diffDays < 0) {
    label = `OVERDUE by ${Math.abs(diffDays)} Days`;
    type = 'danger';
    emoji = '🔴';
  } else if (diffDays === 0) {
    label = 'DUE TODAY';
    type = 'warning';
    emoji = '🟠';
  } else if (diffDays >= 1 && diffDays <= 7) {
    label = `Invoice in ${diffDays} Days`;
    type = 'warning';
    emoji = '🟡';
  } else {
    label = `DUE IN ${diffDays} DAYS`;
    type = 'neutral';
    emoji = '⚪';
  }

  return { hasPayment: false, received: 0, refund: 0, chargeback: 0, net: 0, label, type, emoji };
}

// Auto-categorize expense by keyword
export function categorizeExpense(name) {
  const lower = name.toLowerCase();
  if (/salary|salaries/i.test(lower)) return 'Salaries';
  if (/rent|office|coworking/i.test(lower)) return 'Office & Rent';
  if (/tool|software|subscription|zoho|semrush/i.test(lower)) return 'Tools & Software';
  if (/bill|phone|internet|data|hosting/i.test(lower)) return 'Data & Hosting';
  if (/gst|cs|compliance|legal/i.test(lower)) return 'Compliance & Legal';
  if (/expense|sundry|meeting|dinner/i.test(lower)) return 'Miscellaneous';
  return 'Other';
}

// Parse expense amount string  "₹1,23,456" or "1,23,456" -> 123456
export function parseINRAmount(amountStr) {
  if (typeof amountStr === 'number') return amountStr;
  return parseFloat(String(amountStr).replace(/[₹,\s]/g, '')) || 0;
}

// Parse USD amount string "$350" or "350" -> 350
export function parseUSDAmount(amountStr) {
  if (typeof amountStr === 'number') return amountStr;
  return parseFloat(String(amountStr).replace(/[$,\s]/g, '')) || 0;
}

// Month names for display
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const EXPENSE_CATEGORIES = [
  'Salaries', 'Tools & Software', 'Office & Rent', 'Marketing',
  'Compliance & Legal', 'Data & Hosting', 'Miscellaneous', 'Other'
];

export const CLIENT_STATUSES = ['Active', 'Paused', 'Cancelled'];
export const STATUS_NOTES = ['None', 'Requested cancellation', 'No activity', 'Other'];
export const PAYMENT_METHODS = ['Stripe', 'PayPal', 'Bank Transfer', 'Manual Invoice'];

// Normalize a role name (e.g. "pm2_editor") to its base permission set
export function getBaseRole(role) {
  if (role === 'admin') return 'admin';
  if (role === 'hr_editor') return 'hr_editor';
  return 'pm_editor';
}
